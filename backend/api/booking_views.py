import json
import logging
from collections.abc import Mapping
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings
from django.db import transaction
from django.db.models import Count, F, Q, Sum
from django.db.models.deletion import ProtectedError
from django.http import JsonResponse
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import MethodNotAllowed, ValidationError
from rest_framework.parsers import JSONParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    Booking,
    Passenger,
    PromoCode,
    TripAnnouncement,
    TripDeparture,
    WaitlistEntry,
)
from .mpesa import (
    MpesaError,
    initiate_stk_push,
    is_payment_callback_token_valid,
    normalize_phone_number,
    parse_callback_amount,
    parse_callback_phone,
    parse_callback_receipt,
    query_stk_push,
)
from .serializers import (
    BookingCreateSerializer,
    BookingDetailsEditSerializer,
    BookingSerializer,
    ManualBookingSerializer,
    PromoCodeSerializer,
    TripAnnouncementSerializer,
    TripDepartureSerializer,
    WaitlistEntrySerializer,
)

logger = logging.getLogger(__name__)


class StaffOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_staff)


class TripDepartureViewSet(viewsets.ModelViewSet):
    serializer_class = TripDepartureSerializer
    permission_classes = [StaffOnly]

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.AllowAny()]
        return super().get_permissions()

    def get_queryset(self):
        queryset = TripDeparture.objects.select_related('safari')
        if self.request.method in ('PUT', 'PATCH', 'DELETE'):
            queryset = queryset.select_for_update()
        safari_id = self.request.query_params.get('safari')
        if safari_id:
            queryset = queryset.filter(safari_id=safari_id)
        if not (self.request.user and self.request.user.is_staff):
            # Closed departures stay public so visitors can see them marked "Closed".
            queryset = queryset.filter(
                is_archived=False,
                safari__visible=True,
                start_date__gte=timezone.localdate(),
            )
        return queryset.order_by('start_date')

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        departure = self.get_object()
        previous_available = departure.seats_available
        was_open = departure.is_open
        was_archived = departure.is_archived
        serializer = self.get_serializer(departure, data=request.data, partial=kwargs.pop('partial', False))
        serializer.is_valid(raise_exception=True)
        serializer.save()
        if departure.is_open and not departure.is_archived and departure.start_date >= timezone.localdate() and departure.seats_available > 0 and (
            departure.seats_available > previous_available or not was_open or was_archived
        ):
            transaction.on_commit(lambda: notify_waitlist_for_departure(departure.pk))
        return Response(serializer.data)

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        departure = self.get_object()
        if request.query_params.get('delete_bookings') == 'true':
            departure.bookings.all().delete()
        try:
            departure.delete()
        except ProtectedError:
            transaction.set_rollback(True)
            return Response(
                {
                    'detail': 'This departure has booking records. Archive it to preserve them, or choose Delete with bookings to permanently remove them.',
                    'code': 'departure_has_bookings',
                },
                status=status.HTTP_409_CONFLICT,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


class BookingViewSet(viewsets.ModelViewSet):
    serializer_class = BookingSerializer
    permission_classes = [StaffOnly]
    http_method_names = ['get', 'head', 'options', 'post', 'patch', 'delete']

    def get_queryset(self):
        queryset = Booking.objects.select_related('departure__safari').prefetch_related('passengers')
        departure_id = self.request.query_params.get('departure')
        booking_status = self.request.query_params.get('status')
        if departure_id:
            queryset = queryset.filter(departure_id=departure_id)
        if booking_status:
            queryset = queryset.filter(status=booking_status)
        return queryset

    def create(self, request, *args, **kwargs):
        raise MethodNotAllowed('POST')

    @action(detail=False, methods=['post'], url_path='manual')
    @transaction.atomic
    def manual_create(self, request):
        return self._save_manual_booking(request)

    @action(detail=True, methods=['patch'], url_path='manual')
    @transaction.atomic
    def manual_edit(self, request, pk=None):
        booking = Booking.objects.select_for_update().get(pk=self.get_object().pk)
        if not booking.is_manual:
            raise ValidationError({'detail': 'Payment records from online checkout cannot be edited manually.'})
        return self._save_manual_booking(request, booking)

    def _save_manual_booking(self, request, booking=None):
        if not isinstance(request.data, Mapping) or set(request.data) - set(ManualBookingSerializer().fields):
            raise ValidationError({'detail': 'Only manual booking fields can be saved here.'})
        serializer = ManualBookingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        target_id = data['departure'].pk
        old_departure_id = booking.departure_id if booking else None
        old_count = booking.participant_count if booking and booking.status == Booking.Status.CONFIRMED else 0
        departure_ids = sorted({target_id, *([old_departure_id] if old_departure_id else [])})
        departures = {
            departure.pk: departure for departure in TripDeparture.objects.select_for_update()
            .filter(pk__in=departure_ids).order_by('pk')
        }
        target = departures.get(target_id)
        if target is None or (target.is_archived and target_id != old_departure_id):
            raise ValidationError({'departure': 'Choose a departure that is not archived.'})
        if data['status'] == Booking.Status.CONFIRMED:
            taken = target.seats_taken - (old_count if target_id == old_departure_id else 0)
            if taken + data['participant_count'] > target.seats_total:
                raise ValidationError({'participant_count': f'Only {max(0, target.seats_total - taken)} spots are available.'})

        data['departure'] = target
        data['booking_fee_kes'] = data['amount_kes']
        data['balance_due_kes'] = data['full_amount_kes'] - data['amount_kes']
        if booking is None:
            booking = Booking.objects.create(
                **data, is_manual=True, payment_phone='', booking_terms=target.safari.booking_terms,
            )
            Passenger.objects.create(booking=booking, full_name=booking.full_name, phone=booking.phone)
        else:
            for field, value in data.items():
                setattr(booking, field, value)
            booking.save()
            lead = booking.passengers.first()
            if lead:
                lead.full_name = booking.full_name
                lead.phone = booking.phone
                lead.save(update_fields=['full_name', 'phone'])
            if old_count and (
                old_departure_id != target_id
                or data['status'] != Booking.Status.CONFIRMED
                or data['participant_count'] < old_count
            ):
                transaction.on_commit(lambda: notify_waitlist_for_departure(old_departure_id))
        return Response(self.get_serializer(booking).data, status=status.HTTP_200_OK if old_departure_id else status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch'], url_path='edit-details')
    @transaction.atomic
    def edit_details(self, request, pk=None):
        booking_id = self.get_object().pk
        booking = Booking.objects.select_for_update().get(pk=booking_id)
        allowed_fields = {'departure', 'full_name', 'email', 'phone', 'participant_count', 'passengers'}
        if not isinstance(request.data, Mapping) or set(request.data) - allowed_fields:
            raise ValidationError({'detail': 'Only booking contact, departure, traveler count and passenger details can be edited.'})
        serializer = BookingDetailsEditSerializer(booking, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        target_id = data.get('departure', booking.departure).pk
        old_count = booking.participant_count
        new_count = data.get('participant_count', old_count)
        changes_trip = target_id != booking.departure_id or new_count != old_count
        if changes_trip and (
            booking.status == Booking.Status.PENDING_PAYMENT
            or (booking.status == Booking.Status.PAYMENT_FAILED and booking.checkout_request_id)
        ):
            raise ValidationError({'detail': 'Trip and traveler count cannot be changed while payment may still complete.'})

        departure_ids = sorted({booking.departure_id, target_id})
        locked = {
            departure.pk: departure for departure in TripDeparture.objects.select_for_update()
            .filter(pk__in=departure_ids).order_by('pk')
        }
        current = locked[booking.departure_id]
        target = locked.get(target_id)
        if target is None:
            raise ValidationError({'departure': 'This departure no longer exists.'})
        if changes_trip and target_id != current.pk:
            if target.is_archived or not target.is_open or not target.safari.visible or target.start_date < timezone.localdate():
                raise ValidationError({'departure': 'Choose an open, upcoming departure of a visible safari.'})
        if changes_trip and booking.status == Booking.Status.CONFIRMED:
            taken = target.seats_taken - (booking.participant_count if target_id == current.pk else 0)
            if taken + new_count > target.seats_total:
                raise ValidationError({'participant_count': f'Only {max(0, target.seats_total - taken)} spots are available for this booking.'})

        passengers = data.pop('passengers', None)
        for field, value in data.items():
            setattr(booking, field, value)
        booking.save()
        if passengers is not None:
            existing = {passenger.pk: passenger for passenger in booking.passengers.all()}
            retained = []
            for item in passengers:
                passenger_id = item.pop('id', None)
                if passenger_id is None:
                    passenger = Passenger.objects.create(booking=booking, **item)
                else:
                    passenger = existing[passenger_id]
                    for field, value in item.items():
                        setattr(passenger, field, value)
                    passenger.save()
                retained.append(passenger.pk)
            booking.passengers.exclude(pk__in=retained).delete()
        if changes_trip and booking.status == Booking.Status.CONFIRMED and (
            target_id != current.pk or new_count < old_count
        ):
            transaction.on_commit(lambda: notify_waitlist_for_departure(current.pk))
        return Response(self.get_serializer(booking).data)

    @action(detail=False, methods=['get'])
    def report(self, request):
        start_value = request.query_params.get('start_date')
        end_value = request.query_params.get('end_date')
        try:
            start_date = date.fromisoformat(start_value) if start_value else None
            end_date = date.fromisoformat(end_value) if end_value else None
        except ValueError:
            return Response(
                {'detail': 'Dates must use YYYY-MM-DD format.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if start_date and end_date and start_date > end_date:
            return Response(
                {'detail': 'Start date must be on or before end date.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        bookings = Booking.objects.select_related('departure__safari').all()
        if start_date:
            bookings = bookings.filter(created_at__date__gte=start_date)
        if end_date:
            bookings = bookings.filter(created_at__date__lte=end_date)
        confirmed = bookings.filter(status=Booking.Status.CONFIRMED)
        revenue = confirmed.aggregate(total=Sum('amount_kes'))['total'] or 0
        statuses = {
            row['status']: row['count']
            for row in bookings.values('status').annotate(count=Count('id'))
        }
        trips = confirmed.values(
            'departure__safari_id',
            'departure__safari__title',
        ).annotate(
            confirmed_bookings=Count('id'),
            participants=Sum('participant_count'),
            revenue_kes=Sum('amount_kes'),
        ).order_by('-revenue_kes', 'departure__safari__title')

        return Response({
            'start_date': start_date.isoformat() if start_date else None,
            'end_date': end_date.isoformat() if end_date else None,
            'total_bookings': bookings.count(),
            'confirmed_bookings': confirmed.count(),
            'participants': confirmed.aggregate(total=Sum('participant_count'))['total'] or 0,
            'revenue_kes': revenue,
            'status_counts': statuses,
            'by_safari': [
                {
                    'safari_id': row['departure__safari_id'],
                    'safari_title': row['departure__safari__title'],
                    'confirmed_bookings': row['confirmed_bookings'],
                    'participants': row['participants'],
                    'revenue_kes': row['revenue_kes'],
                }
                for row in trips
            ],
        })

    def partial_update(self, request, *args, **kwargs):
        booking = self.get_object()
        new_status = request.data.get('status')
        allowed_statuses = {
            Booking.Status.CANCELLED,
            Booking.Status.REFUND_REQUIRED,
        }
        if new_status not in allowed_statuses:
            return Response(
                {'detail': 'Bookings can only be cancelled or flagged for refund by an administrator.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if booking.status == Booking.Status.CONFIRMED and new_status == Booking.Status.CANCELLED:
            return Response(
                {'detail': 'Confirmed paid bookings cannot be cancelled here. Arrange the refund first.'},
                status=status.HTTP_409_CONFLICT,
            )
        notify_waitlist = booking.status == Booking.Status.PENDING_PAYMENT
        booking.status = new_status
        booking.save(update_fields=['status', 'updated_at'])
        if notify_waitlist:
            transaction.on_commit(lambda: notify_waitlist_for_departure(booking.departure_id))
        return Response(self.get_serializer(booking).data)


class PromoCodeViewSet(viewsets.ModelViewSet):
    queryset = PromoCode.objects.all()
    serializer_class = PromoCodeSerializer
    permission_classes = [StaffOnly]
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']


class TripAnnouncementViewSet(viewsets.ModelViewSet):
    serializer_class = TripAnnouncementSerializer
    permission_classes = [StaffOnly]

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.AllowAny()]
        return super().get_permissions()

    def get_queryset(self):
        queryset = TripAnnouncement.objects.all()
        if not (self.request.user and self.request.user.is_staff):
            now = timezone.now()
            queryset = queryset.filter(active=True).filter(
                Q(starts_at__isnull=True) | Q(starts_at__lte=now),
            ).filter(
                Q(ends_at__isnull=True) | Q(ends_at__gte=now),
            )
        return queryset


class BookingCreateView(APIView):
    permission_classes = [permissions.AllowAny]
    parser_classes = [JSONParser]

    def post(self, request):
        if not settings.ONLINE_PAYMENTS_ENABLED:
            return Response(
                {'detail': 'Online booking payments are temporarily unavailable. Please contact us by WhatsApp or phone.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        serializer = BookingCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            phone = normalize_phone_number(data['payment_phone'])
        except ValueError as error:
            raise ValidationError({'payment_phone': str(error)}) from error
        now = timezone.now()
        payment_error = None

        with transaction.atomic():
            try:
                departure = TripDeparture.objects.select_for_update().select_related('safari').get(
                    pk=data['departure'].pk,
                    is_open=True,
                    is_archived=False,
                    safari__visible=True,
                    start_date__gte=timezone.localdate(),
                )
            except TripDeparture.DoesNotExist as error:
                raise ValidationError({'departure': 'This trip departure is no longer available.'}) from error

            Booking.objects.filter(
                departure=departure,
                status=Booking.Status.PENDING_PAYMENT,
                expires_at__lte=now,
            ).update(status=Booking.Status.PAYMENT_FAILED)

            taken = departure.bookings.filter(
                Q(status=Booking.Status.CONFIRMED)
                | Q(status=Booking.Status.PENDING_PAYMENT, expires_at__gt=now)
            ).aggregate(total=Sum('participant_count'))['total'] or 0
            participants = data['participant_count']
            if participants > departure.seats_total - taken:
                raise ValidationError({
                    'participant_count': f'Only {max(0, departure.seats_total - taken)} spots remain.'
                })

            promo = None
            full_amount = departure.price_kes * participants
            discount_amount = 0
            discounted_total = full_amount
            promo_code = data.get('promo_code', '').strip().upper()
            if promo_code:
                try:
                    promo = PromoCode.objects.select_for_update().get(code__iexact=promo_code)
                except PromoCode.DoesNotExist as error:
                    raise ValidationError({'promo_code': 'This promo code is not valid.'}) from error
                if not promo.active:
                    raise ValidationError({'promo_code': 'This promo code is no longer active.'})
                if promo.starts_at and promo.starts_at > now:
                    raise ValidationError({'promo_code': 'This promo code is not active yet.'})
                if promo.ends_at and promo.ends_at < now:
                    raise ValidationError({'promo_code': 'This promo code has expired.'})
                if promo.max_uses is not None and promo.uses_count >= promo.max_uses:
                    raise ValidationError({'promo_code': 'This promo code has reached its usage limit.'})
                pending_uses = Booking.objects.filter(
                    promo_code=promo,
                    status=Booking.Status.PENDING_PAYMENT,
                    expires_at__gt=now,
                ).count()
                if promo.max_uses is not None and promo.uses_count + pending_uses >= promo.max_uses:
                    raise ValidationError({'promo_code': 'This promo code has reached its usage limit.'})
                if participants < promo.min_participants:
                    raise ValidationError({
                        'promo_code': f'This promo code requires at least {promo.min_participants} participants.'
                    })
                discount = (
                    Decimal(full_amount) * promo.value / Decimal(100)
                    if promo.discount_type == PromoCode.DiscountType.PERCENT
                    else promo.value
                ).quantize(Decimal('1'), rounding=ROUND_HALF_UP)
                if discount >= full_amount:
                    raise ValidationError({'promo_code': 'This discount must leave at least KES 1 to pay.'})
                discount_amount = int(discount)
                discounted_total -= discount_amount

            booking_fee = departure.safari.booking_fee_kes
            if not booking_fee:
                raise ValidationError({
                    'departure': 'The booking fee has not been configured for this safari yet.'
                })
            if booking_fee > full_amount:
                raise ValidationError({
                    'departure': 'The booking fee cannot exceed the full trip amount.'
                })
            if booking_fee > discounted_total:
                raise ValidationError({
                    'promo_code': 'The discount cannot reduce the trip total below the booking fee.'
                })
            balance_due = discounted_total - booking_fee

            booking = Booking.objects.create(
                departure=departure,
                promo_code=promo,
                full_name=data['full_name'],
                email=data['email'],
                phone=data['phone'],
                participant_count=participants,
                amount_kes=booking_fee,
                full_amount_kes=full_amount,
                booking_fee_kes=booking_fee,
                discount_kes=discount_amount,
                balance_due_kes=balance_due,
                booking_terms=departure.safari.booking_terms,
                terms_accepted_at=now if data.get('terms_accepted') else None,
                payment_phone=phone,
                expires_at=now + timedelta(minutes=10),
            )
            passenger_data = data.get('passengers') or [{'full_name': data['full_name']}]
            Passenger.objects.bulk_create([
                Passenger(
                    booking=booking,
                    full_name=passenger['full_name'].strip(),
                    phone=passenger.get('phone', '').strip(),
                    emergency_contact=passenger.get('emergency_contact', '').strip(),
                )
                for passenger in passenger_data
            ])
            try:
                stk = initiate_stk_push(booking=booking, phone=phone)
            except (MpesaError, ValueError) as error:
                logger.warning('Could not initiate M-Pesa for booking %s: %s', booking.reference, error)
                booking.status = Booking.Status.PAYMENT_FAILED
                booking.expires_at = None
                booking.save(update_fields=['status', 'expires_at', 'updated_at'])
                transaction.on_commit(lambda: notify_waitlist_for_departure(departure.pk))
                payment_error = str(error)
            else:
                booking.checkout_request_id = stk['checkout_request_id']
                booking.merchant_request_id = stk['merchant_request_id']
                booking.payment_phone = stk['payment_phone']
                booking.save(update_fields=[
                    'checkout_request_id',
                    'merchant_request_id',
                    'payment_phone',
                    'updated_at',
                ])
                return Response({
                    'reference': booking.reference,
                    'status': booking.status,
                    'amount_kes': booking.amount_kes,
                    'full_amount_kes': booking.full_amount_kes,
                    'booking_fee_kes': booking.booking_fee_kes,
                    'discount_kes': booking.discount_kes,
                    'balance_due_kes': booking.balance_due_kes,
                    'currency': 'KES',
                    'expires_at': booking.expires_at,
                    'message': stk['customer_message'],
                }, status=status.HTTP_201_CREATED)

        return Response(
            {'detail': payment_error or 'Could not start M-Pesa payment.'},
            status=status.HTTP_502_BAD_GATEWAY,
        )


class BookingStatusView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, reference):
        booking = Booking.objects.filter(reference=reference).first()
        if not booking:
            return Response({'detail': 'Booking reference not found.'}, status=status.HTTP_404_NOT_FOUND)
        if (
            booking.status == Booking.Status.PENDING_PAYMENT
            and booking.expires_at
            and booking.expires_at <= timezone.now()
        ):
            booking.status = Booking.Status.PAYMENT_FAILED
            booking.expires_at = None
            booking.save(update_fields=['status', 'expires_at', 'updated_at'])
            transaction.on_commit(lambda: notify_waitlist_for_departure(booking.departure_id))
        return Response({
            'reference': booking.reference,
            'status': booking.status,
            'amount_kes': booking.amount_kes,
            'full_amount_kes': booking.full_amount_kes,
            'booking_fee_kes': booking.booking_fee_kes,
            'discount_kes': booking.discount_kes,
            'balance_due_kes': booking.balance_due_kes,
            'currency': 'KES',
            'mpesa_receipt': booking.mpesa_receipt or None,
            'expires_at': booking.expires_at,
        })


class WaitlistViewSet(viewsets.ModelViewSet):
    serializer_class = WaitlistEntrySerializer
    http_method_names = ['get', 'post', 'head', 'options', 'patch']

    def get_permissions(self):
        if self.request.method == 'POST':
            return [permissions.AllowAny()]
        return [StaffOnly()]

    def get_queryset(self):
        queryset = WaitlistEntry.objects.select_related('departure__safari')
        departure_id = self.request.query_params.get('departure')
        if departure_id:
            queryset = queryset.filter(departure_id=departure_id)
        return queryset

    def partial_update(self, request, *args, **kwargs):
        entry = self.get_object()
        new_status = request.data.get('status')
        if new_status not in WaitlistEntry.Status.values:
            return Response({'detail': 'Invalid waitlist status.'}, status=status.HTTP_400_BAD_REQUEST)
        entry.status = new_status
        entry.save(update_fields=['status'])
        return Response(self.get_serializer(entry).data)

    def perform_create(self, serializer):
        with transaction.atomic():
            try:
                departure = TripDeparture.objects.select_for_update().get(
                    pk=serializer.validated_data['departure'].pk
                )
            except TripDeparture.DoesNotExist as error:
                raise ValidationError({'departure': 'This departure no longer exists.'}) from error
            if departure.is_archived:
                raise ValidationError({'departure': 'This departure is no longer available.'})
            if not departure.is_open or departure.seats_available:
                raise ValidationError({'departure': 'This departure still has spots; book directly instead.'})
            duplicate = WaitlistEntry.objects.filter(
                departure=departure,
                email__iexact=serializer.validated_data['email'],
                status=WaitlistEntry.Status.WAITING,
            ).exists()
            if duplicate:
                raise ValidationError({'email': 'This email is already on the waitlist for the departure.'})
            serializer.save(departure=departure)


@method_decorator(csrf_exempt, name='dispatch')
class MpesaCallbackView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    parser_classes = [JSONParser]

    def post(self, request, token):
        if not is_payment_callback_token_valid(token):
            return JsonResponse({'detail': 'Not found.'}, status=404)
        callback = request.data.get('Body', {}).get('stkCallback', {})
        checkout_id = callback.get('CheckoutRequestID')
        merchant_id = callback.get('MerchantRequestID')
        if not checkout_id or not merchant_id:
            return JsonResponse({'detail': 'Invalid payment callback.'}, status=400)
        booking = Booking.objects.filter(checkout_request_id=checkout_id).first()
        if not booking:
            logger.warning('Received M-Pesa callback for unknown checkout request %s', checkout_id)
            return JsonResponse({'ResultCode': 0, 'ResultDesc': 'Accepted'})
        if booking.status not in (Booking.Status.PENDING_PAYMENT, Booking.Status.PAYMENT_FAILED):
            return JsonResponse({'ResultCode': 0, 'ResultDesc': 'Already processed'})

        try:
            result_code = int(callback.get('ResultCode'))
        except (TypeError, ValueError):
            return JsonResponse({'detail': 'Invalid payment result code.'}, status=400)
        if result_code == 0:
            try:
                payment_status = query_stk_push(checkout_request_id=checkout_id)
            except MpesaError as error:
                logger.error('Could not verify M-Pesa payment for booking %s: %s', booking.reference, error)
                return JsonResponse({'detail': 'Payment verification is temporarily unavailable.'}, status=503)
            if (
                payment_status.get('CheckoutRequestID') != checkout_id
                or payment_status.get('MerchantRequestID') != merchant_id
                or str(payment_status.get('ResultCode')) != '0'
            ):
                logger.error('Daraja query did not confirm successful payment for booking %s.', booking.reference)
                return JsonResponse({'detail': 'Payment verification is not complete.'}, status=503)
        metadata = callback.get('CallbackMetadata', {}).get('Item', [])
        amount = parse_callback_amount(metadata) if result_code == 0 else None
        receipt = parse_callback_receipt(metadata) if result_code == 0 else ''
        callback_phone = parse_callback_phone(metadata) if result_code == 0 else ''
        try:
            callback_phone = normalize_phone_number(callback_phone) if callback_phone else ''
        except ValueError:
            callback_phone = ''

        with transaction.atomic():
            booking = Booking.objects.select_for_update().select_related('departure').get(pk=booking.pk)
            if booking.status not in (Booking.Status.PENDING_PAYMENT, Booking.Status.PAYMENT_FAILED):
                return JsonResponse({'ResultCode': 0, 'ResultDesc': 'Already processed'})
            departure = TripDeparture.objects.select_for_update().get(pk=booking.departure_id)

            if result_code != 0:
                if booking.status == Booking.Status.PENDING_PAYMENT:
                    booking.status = Booking.Status.PAYMENT_FAILED
                    booking.expires_at = None
                    booking.save(update_fields=['status', 'expires_at', 'updated_at'])
                transaction.on_commit(lambda: notify_waitlist_for_departure(booking.departure_id))
                return JsonResponse({'ResultCode': 0, 'ResultDesc': 'Accepted'})

            if (
                callback.get('MerchantRequestID') != booking.merchant_request_id
                or amount != booking.amount_kes
                or callback_phone != booking.payment_phone
                or not receipt
            ):
                logger.error('M-Pesa callback details did not match booking %s', booking.reference)
                booking.status = Booking.Status.REFUND_REQUIRED
                booking.mpesa_receipt = receipt
                booking.expires_at = None
                booking.save(update_fields=['status', 'mpesa_receipt', 'expires_at', 'updated_at'])
                transaction.on_commit(lambda: notify_waitlist_for_departure(departure.pk))
                return JsonResponse({'ResultCode': 0, 'ResultDesc': 'Accepted'})

            now = timezone.now()
            Booking.objects.filter(
                departure=departure,
                status=Booking.Status.PENDING_PAYMENT,
                expires_at__lte=now,
            ).exclude(pk=booking.pk).update(status=Booking.Status.PAYMENT_FAILED)
            seats_taken = departure.bookings.filter(
                Q(status=Booking.Status.CONFIRMED)
                | Q(status=Booking.Status.PENDING_PAYMENT, expires_at__gt=now)
            ).exclude(pk=booking.pk).aggregate(total=Sum('participant_count'))['total'] or 0
            if seats_taken + booking.participant_count > departure.seats_total:
                booking.status = Booking.Status.REFUND_REQUIRED
                transaction.on_commit(lambda: notify_waitlist_for_departure(departure.pk))
            else:
                booking.status = Booking.Status.CONFIRMED
                if booking.promo_code_id:
                    PromoCode.objects.filter(pk=booking.promo_code_id).update(
                        uses_count=F('uses_count') + 1
                    )
                transaction.on_commit(lambda: notify_waitlist_for_departure(booking.departure_id))
            booking.mpesa_receipt = receipt
            booking.expires_at = None
            booking.save(update_fields=['status', 'mpesa_receipt', 'expires_at', 'updated_at'])
            if booking.status == Booking.Status.CONFIRMED:
                from .notifications import send_booking_confirmation
                transaction.on_commit(lambda: send_booking_confirmation(booking.pk))

        return JsonResponse({'ResultCode': 0, 'ResultDesc': 'Accepted'})


def notify_waitlist_for_departure(departure_id):
    with transaction.atomic():
        try:
            departure = TripDeparture.objects.select_for_update().select_related('safari').get(pk=departure_id)
        except TripDeparture.DoesNotExist:
            logger.warning('Cannot notify waitlist; departure %s no longer exists.', departure_id)
            return
        if departure.is_archived:
            return
        available = departure.seats_available
        entries = []
        for entry in departure.waitlist_entries.filter(status=WaitlistEntry.Status.WAITING).order_by('created_at'):
            if entry.participant_count <= available:
                entries.append(entry)
                available -= entry.participant_count
        for entry in entries:
            entry.status = WaitlistEntry.Status.NOTIFIED
            entry.notified_at = timezone.now()
            entry.save(update_fields=['status', 'notified_at'])

    from .notifications import send_waitlist_open_spot
    for entry in entries:
        if not send_waitlist_open_spot(entry):
            entry.status = WaitlistEntry.Status.WAITING
            entry.notified_at = None
            entry.save(update_fields=['status', 'notified_at'])
