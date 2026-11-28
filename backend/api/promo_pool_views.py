import secrets

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from .models import PromoPoolCode, Safari

CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
MAX_BATCH_SIZE = 100


class PromoPoolClaimThrottle(AnonRateThrottle):
    scope = 'promo_pool_claim'
    rate = '10/hour'


def available_for(safari_id):
    """Active, unused-or-used pool codes that apply to a trip (no trips selected = all trips)."""
    return PromoPoolCode.objects.filter(is_active=True).filter(
        Q(safaris__isnull=True) | Q(safaris__pk=safari_id)
    ).distinct()


def counts_for(safari_id):
    codes = available_for(safari_id)
    return {'total': codes.count(), 'remaining': codes.filter(claimed_at__isnull=True).count()}


def new_code():
    while True:
        code = 'SIMBA-' + ''.join(secrets.choice(CODE_ALPHABET) for _ in range(5))
        if not PromoPoolCode.objects.filter(code=code).exists():
            return code


class PromoPoolStatusView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        try:
            safari_id = int(request.query_params.get('safari'))
        except (TypeError, ValueError):
            return Response({'total': 0, 'remaining': 0})
        return Response(counts_for(safari_id))


class PromoPoolClaimView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [PromoPoolClaimThrottle]

    def post(self, request):
        try:
            safari = Safari.objects.get(pk=request.data.get('safari'), visible=True)
        except (Safari.DoesNotExist, TypeError, ValueError) as error:
            raise ValidationError({'safari': 'This trip is not available.'}) from error
        with transaction.atomic():
            candidates = list(
                PromoPoolCode.objects.select_for_update()
                .filter(pk__in=available_for(safari.pk).filter(claimed_at__isnull=True).values('pk'))
            )
            if not candidates:
                return Response({'detail': 'No promo codes left.'}, status=status.HTTP_409_CONFLICT)
            promo = secrets.choice(candidates)
            price = int(safari.price)
            discounted = max(price - promo.discount_kes, 1)
            promo.claimed_at = timezone.now()
            promo.claimed_trip = safari.title
            promo.claimed_price_kes = discounted
            promo.save(update_fields=['claimed_at', 'claimed_trip', 'claimed_price_kes'])
        return Response({
            'code': promo.code,
            'discount_kes': promo.discount_kes,
            'original_price_kes': price,
            'discounted_price_kes': discounted,
            **counts_for(safari.pk),
        }, status=status.HTTP_201_CREATED)


class PromoPoolAdminViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAdminUser]
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        return PromoPoolCode.objects.prefetch_related('safaris')

    def get_serializer_class(self):
        from .serializers import PromoPoolCodeSerializer
        return PromoPoolCodeSerializer

    def create(self, request, *args, **kwargs):
        return self.generate(request)

    @action(detail=False, methods=['post'])
    def generate(self, request):
        items = request.data.get('items')
        if not isinstance(items, list) or not items:
            raise ValidationError({'items': 'Add at least one discount amount.'})
        parsed = []
        for item in items:
            try:
                discount = int(item.get('discount_kes'))
                quantity = int(item.get('quantity'))
            except (AttributeError, TypeError, ValueError) as error:
                raise ValidationError({'items': 'Each row needs a whole discount amount and quantity.'}) from error
            if discount < 1 or quantity < 1:
                raise ValidationError({'items': 'Discount and quantity must be at least 1.'})
            parsed.append((discount, quantity))
        if sum(quantity for _, quantity in parsed) > MAX_BATCH_SIZE:
            raise ValidationError({'items': f'A batch can have at most {MAX_BATCH_SIZE} codes.'})
        safari_ids = request.data.get('safari_ids') or []
        if not isinstance(safari_ids, list):
            raise ValidationError({'safari_ids': 'Choose trips from the list.'})
        safaris = list(Safari.objects.filter(pk__in=safari_ids))
        if len(safaris) != len(set(safari_ids)):
            raise ValidationError({'safari_ids': 'One of the selected trips no longer exists.'})
        with transaction.atomic():
            created = []
            for discount, quantity in parsed:
                for _ in range(quantity):
                    code = PromoPoolCode.objects.create(code=new_code(), discount_kes=discount)
                    code.safaris.set(safaris)
                    created.append(code)
        serializer = self.get_serializer(created, many=True)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='clear-used')
    def clear_used(self, request):
        deleted, _ = PromoPoolCode.objects.filter(claimed_at__isnull=False).delete()
        return Response({'deleted': deleted})
