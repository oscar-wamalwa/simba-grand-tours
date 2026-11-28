"""
Django REST Framework views for Simba Grand Tours API.
"""

import base64
import io
import logging
import smtplib

from django.conf import settings
from django.http import HttpResponse
from PIL import Image
from django.core.mail import get_connection, send_mail
from django.db.models.deletion import ProtectedError
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
try:
    from rest_framework.response import Response
except Exception:
    # Fallback to Django's JsonResponse when DRF is not available (helps editors/static checkers).
    # This fallback implements a minimal compatible Response signature used in this module.
    from django.http import JsonResponse

    class Response(JsonResponse):
        def __init__(self, data, status=200, *args, **kwargs):
            # DRF's Response uses `safe=False` for non-dict JSON; keep that behaviour.
            super().__init__(data, status=status, safe=False, *args, **kwargs)
from django.utils import timezone
from .models import (
    Blog,
    BlogComment,
    Booking,
    ContactMessage,
    Destination,
    Safari,
    Settings,
    Subscriber,
    Testimonial,
)
from .serializers import (
    BlogCommentSerializer, BlogSerializer, DestinationSerializer, SafariSerializer, SubscriberSerializer,
    ContactMessageSerializer, ContactMessageReplySerializer, SettingsSerializer,
    SubscriberUpdateSerializer, TestimonialSerializer
)
from .subscriber_campaigns import SubscriberSmsError, send_subscriber_sms

logger = logging.getLogger(__name__)


class PublicBlogSubmissionThrottle(AnonRateThrottle):
    scope = 'public_blog_submission'
    rate = '5/hour'


class PublicBlogCommentThrottle(AnonRateThrottle):
    scope = 'public_blog_comment'
    rate = '10/hour'


class PublicSubscriberThrottle(AnonRateThrottle):
    scope = 'public_subscriber'
    rate = '5/hour'


class StaffWritePermission(permissions.BasePermission):
    """Keep content administration private while allowing selected public reads/submissions."""
    def has_permission(self, request, view):
        if request.method == 'OPTIONS':
            return True
        if request.method in permissions.SAFE_METHODS:
            return getattr(view, 'public_read', False) or bool(
                request.user and request.user.is_staff
            )
        if getattr(view, 'public_create', False) and getattr(view, 'action', None) == 'create':
            return True
        return bool(request.user and request.user.is_staff)


class SafariViewSet(viewsets.ModelViewSet):
    """ViewSet for Safari CRUD operations."""
    queryset = Safari.objects.all()
    serializer_class = SafariSerializer
    permission_classes = [StaffWritePermission]
    public_read = True

    def get_queryset(self):
        queryset = Safari.objects.prefetch_related('departures')
        if not (self.request.user and self.request.user.is_staff):
            queryset = queryset.filter(visible=True)
        
        # Filter by visibility
        visible = self.request.query_params.get('visible')
        if visible is not None:
            queryset = queryset.filter(visible=visible.lower() == 'true')
        
        # Filter by signature status
        signature = self.request.query_params.get('signature')
        if signature is not None:
            queryset = queryset.filter(is_signature=signature.lower() == 'true')
        
        # Filter by location
        location = self.request.query_params.get('location')
        if location:
            queryset = queryset.filter(location__icontains=location)
        
        return queryset.order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save()

    def perform_update(self, serializer):
        serializer.save(updated_at=timezone.now())

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {'detail': 'This safari has departures with bookings. Delete those departures separately first, or hide the safari to preserve the records.'},
                status=status.HTTP_409_CONFLICT,
            )

    def create(self, request, *args, **kwargs):
        """Handle safari creation by converting camelCase to snake_case."""
        print(f"[DEBUG] SafariViewSet.create - request.data: {dict(request.data)}")
        # Convert isSignature to is_signature
        data = dict(request.data)
        if 'isSignature' in data:
            print(f"[DEBUG] Found isSignature: {data['isSignature']}")
            data['is_signature'] = data.pop('isSignature')
        print(f"[DEBUG] SafariViewSet.create - converted data: {data}")
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        print(f"[DEBUG] Safari created successfully: {serializer.data}")
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        """Handle safari update by converting camelCase to snake_case."""
        print(f"[DEBUG] SafariViewSet.update - request.data: {dict(request.data)}")
        # Convert isSignature to is_signature
        data = dict(request.data)
        if 'isSignature' in data:
            print(f"[DEBUG] Found isSignature: {data['isSignature']}")
            data['is_signature'] = data.pop('isSignature')
        print(f"[DEBUG] SafariViewSet.update - converted data: {data}")
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        print(f"[DEBUG] Safari updated successfully: {serializer.data}")
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def signature(self, request):
        """Get signature safaris for homepage."""
        signature_safaris = Safari.objects.filter(is_signature=True, visible=True)[:3]
        serializer = self.get_serializer(signature_safaris, many=True)
        return Response(serializer.data)


class DestinationViewSet(viewsets.ModelViewSet):
    queryset = Destination.objects.all()
    serializer_class = DestinationSerializer
    permission_classes = [StaffWritePermission]
    public_read = True

    def get_queryset(self):
        queryset = Destination.objects.all().prefetch_related('safaris')
        if not (self.request.user and self.request.user.is_staff):
            queryset = queryset.filter(visible=True)
        return queryset.order_by('sort_order', 'name')


class BlogViewSet(viewsets.ModelViewSet):
    """ViewSet for Blog CRUD operations."""
    queryset = Blog.objects.all()
    serializer_class = BlogSerializer
    permission_classes = [StaffWritePermission]
    public_read = True
    public_create = True

    def get_throttles(self):
        if self.action == 'create' and not (self.request.user and self.request.user.is_staff):
            return [PublicBlogSubmissionThrottle()]
        return super().get_throttles()

    def get_queryset(self):
        queryset = Blog.objects.all()
        if not (self.request.user and self.request.user.is_staff):
            queryset = queryset.filter(status='published')
        
        # Filter by status
        blog_status = self.request.query_params.get('status')
        if blog_status:
            queryset = queryset.filter(status=blog_status)
        
        # Filter by category
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category=category)
        
        return queryset.order_by('-created_at')

    def perform_create(self, serializer):
        if self.request.user and self.request.user.is_staff:
            serializer.save()
        else:
            serializer.save(status='pending_review')

    def perform_update(self, serializer):
        serializer.save(updated_at=timezone.now())


class BlogCommentViewSet(viewsets.ModelViewSet):
    """Moderate reader replies before they are shown with a published post."""

    queryset = BlogComment.objects.select_related('blog').all()
    serializer_class = BlogCommentSerializer
    permission_classes = [StaffWritePermission]
    public_read = True
    public_create = True

    def get_throttles(self):
        if self.action == 'create' and not (self.request.user and self.request.user.is_staff):
            return [PublicBlogCommentThrottle()]
        return super().get_throttles()

    def get_queryset(self):
        queryset = BlogComment.objects.select_related('blog')
        if not (self.request.user and self.request.user.is_staff):
            queryset = queryset.filter(status='approved', blog__status='published')
        blog_id = self.request.query_params.get('blog')
        if blog_id:
            queryset = queryset.filter(blog_id=blog_id)
        return queryset.order_by('created_at')

    def perform_create(self, serializer):
        blog = serializer.validated_data['blog']
        if blog.status != 'published':
            raise ValidationError({'blog': 'Replies can only be added to published blog posts.'})
        serializer.save(status='pending_review')


class SubscriberViewSet(viewsets.ModelViewSet):
    """ViewSet for Subscriber CRUD operations."""
    queryset = Subscriber.objects.all()
    serializer_class = SubscriberSerializer
    http_method_names = ['get', 'head', 'options', 'post', 'patch', 'delete']
    permission_classes = [StaffWritePermission]
    public_create = True

    def get_throttles(self):
        if self.action == 'create' and not (self.request.user and self.request.user.is_staff):
            return [PublicSubscriberThrottle()]
        return super().get_throttles()

    def create(self, request, *args, **kwargs):
        """Handle subscriber creation with duplicate check."""
        email = request.data.get('email')
        if Subscriber.objects.filter(email=email).exists():
            return Response(
                {'detail': 'Email already subscribed'},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().create(request, *args, **kwargs)

    @action(detail=False, methods=['post'])
    def send_update(self, request):
        campaign_serializer = SubscriberUpdateSerializer(data=request.data)
        campaign_serializer.is_valid(raise_exception=True)
        channel = campaign_serializer.validated_data['channel']
        subject = campaign_serializer.validated_data.get('subject', '').strip()
        message = campaign_serializer.validated_data['message']

        subscribers = list(Subscriber.objects.all())
        email_recipients = [subscriber for subscriber in subscribers if subscriber.email]
        sms_recipients = [
            subscriber for subscriber in subscribers
            if subscriber.sms_opt_in and subscriber.phone
        ]
        if channel in ('email', 'both') and not email_recipients:
            return Response(
                {'detail': 'There are no subscribers with email addresses to receive this update.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if channel in ('sms', 'both') and not sms_recipients:
            return Response(
                {'detail': 'There are no subscribers who opted in to SMS updates.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if channel in ('email', 'both') and not getattr(settings, 'DEFAULT_FROM_EMAIL', '').strip():
            return Response(
                {'detail': 'Email sending is not configured. Set DEFAULT_FROM_EMAIL and SMTP settings.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        if channel in ('sms', 'both') and (
            not getattr(settings, 'AFRICASTALKING_USERNAME', '')
            or not getattr(settings, 'AFRICASTALKING_API_KEY', '')
        ):
            return Response(
                {'detail': 'Africa’s Talking is not configured on the backend.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        results = {}
        if channel in ('email', 'both'):
            email_sent = 0
            email_failed = 0
            email_errors = []
            email_connection = None
            try:
                email_connection = get_connection()
                email_connection.open()
            except (OSError, RuntimeError, smtplib.SMTPException) as error:
                logger.error('Subscriber email connection failed: %s', type(error).__name__)
                email_failed = len(email_recipients)
                email_errors.append('Email provider failed to accept one or more messages.')
            else:
                for subscriber in email_recipients:
                    try:
                        accepted = send_mail(
                            subject,
                            message,
                            settings.DEFAULT_FROM_EMAIL,
                            [subscriber.email],
                            fail_silently=False,
                            connection=email_connection,
                        )
                    except (OSError, RuntimeError, smtplib.SMTPException) as error:
                        logger.error('Subscriber email delivery failed: %s', type(error).__name__)
                        email_failed += 1
                        email_errors.append('Email provider failed to accept one or more messages.')
                        continue
                    if accepted == 1:
                        email_sent += 1
                    else:
                        email_failed += 1
                        email_errors.append('Email provider did not accept one or more messages.')
            finally:
                if email_connection:
                    try:
                        email_connection.close()
                    except (OSError, RuntimeError, smtplib.SMTPException) as error:
                        logger.warning('Subscriber email connection close failed: %s', type(error).__name__)
            results['email'] = {
                'attempted': len(email_recipients),
                'sent': email_sent,
                'failed': email_failed,
                'errors': sorted(set(email_errors)),
            }

        if channel in ('sms', 'both'):
            try:
                results['sms'] = send_subscriber_sms(sms_recipients, message)
            except SubscriberSmsError as error:
                logger.error('Subscriber SMS campaign failed: %s', error)
                results['sms'] = {
                    'attempted': len(sms_recipients),
                    'sent': 0,
                    'failed': len(sms_recipients),
                    'errors': [str(error)],
                }

        return Response({
            'detail': 'Subscriber update dispatch completed. Review each channel’s delivery counts.',
            'results': results,
        })


class ContactMessageViewSet(viewsets.ModelViewSet):
    """ViewSet for ContactMessage CRUD operations."""
    queryset = ContactMessage.objects.all()
    serializer_class = ContactMessageSerializer
    http_method_names = ['get', 'head', 'options', 'post', 'patch', 'delete']
    permission_classes = [StaffWritePermission]
    public_create = True

    def get_queryset(self):
        queryset = ContactMessage.objects.all()
        
        # Filter by read status
        unread = self.request.query_params.get('unread')
        if unread is not None:
            queryset = queryset.filter(read=unread.lower() == 'true')
        
        return queryset.order_by('-submitted_at')

    def perform_update(self, serializer):
        # Set read_at timestamp when marking as read
        if serializer.instance and serializer.instance.read is False:
            serializer.save(read_at=timezone.now())
        else:
            serializer.save()

    @action(detail=True, methods=['post'])
    def reply(self, request, pk=None):
        contact_message = self.get_object()
        reply_serializer = ContactMessageReplySerializer(data=request.data)
        reply_serializer.is_valid(raise_exception=True)

        sender = getattr(settings, 'DEFAULT_FROM_EMAIL', '').strip()
        if not sender:
            return Response(
                {'detail': 'Email sending is not configured. Set DEFAULT_FROM_EMAIL and SMTP settings.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        recipient = (contact_message.email or '').strip()
        if not recipient or recipient.lower() == 'no-reply@simbagrandtours.com':
            return Response(
                {'detail': 'This contact message does not have a valid reply email address.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        original_subject = ' '.join((contact_message.subject or '').splitlines()).strip()
        subject = f'Re: {original_subject}' if original_subject else 'Reply from Simba Grand Tours'
        recipient_name = (contact_message.full_name or '').strip() or 'there'
        body = (
            f'Hello {recipient_name},\n\n'
            f'{reply_serializer.validated_data["message"]}\n\n'
            'Regards,\nSimba Grand Tours'
        )

        try:
            sent_count = send_mail(subject, body, sender, [recipient], fail_silently=False)
        except (OSError, RuntimeError, smtplib.SMTPException) as error:
            logger.error('Could not send reply for contact message %s: %s', contact_message.pk, error)
            return Response(
                {'detail': 'The reply could not be sent. Check the SMTP settings and try again.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        if sent_count != 1:
            logger.error('Email backend did not accept reply for contact message %s.', contact_message.pk)
            return Response(
                {'detail': 'The email provider did not accept the reply. Try again later.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response({'detail': 'Reply sent successfully.'}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        """Get count of unread messages."""
        count = ContactMessage.objects.filter(read=False).count()
        return Response({'unread_count': count})

    @action(detail=False, methods=['get'])
    def featured(self, request):
        """Get featured testimonials based on settings."""
        from .models import Settings
        try:
            settings = Settings.objects.get(id='website_settings')
            featured_ids = settings.featured_testimonials or []
            # Return messages matching the featured IDs
            featured_messages = ContactMessage.objects.filter(id__in=featured_ids)
            serializer = self.get_serializer(featured_messages, many=True)
            return Response(serializer.data)
        except Settings.DoesNotExist:
            return Response([])


class SettingsViewSet(viewsets.ModelViewSet):
    """ViewSet for Settings CRUD operations."""
    queryset = Settings.objects.all()
    serializer_class = SettingsSerializer
    http_method_names = ['get', 'head', 'options', 'patch']  # Only GET and PATCH
    permission_classes = [StaffWritePermission]
    public_read = True

    def get_object(self):
        """Get settings object (always returns the website_settings)."""
        obj, created = Settings.objects.get_or_create(
            id='website_settings',
            defaults={
                'site_name': 'Simba Grand Tours',
                'site_email': 'simbagrandtours@gmail.com',
                'site_phone': '+254 707 984 287',
                'address': 'Platinumz Plaza, Tom Mboya Street, Nairobi CBD',
                'website': 'https://simbagrandtours.co.ke',
            }
        )
        return obj

    def get_queryset(self):
        return Settings.objects.filter(id='website_settings')

    def update(self, request, *args, **kwargs):
        """Handle settings update."""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        serializer.save(updated_at=timezone.now())
        return Response(serializer.data)


class TestimonialViewSet(viewsets.ModelViewSet):
    """ViewSet for Testimonial CRUD operations."""
    queryset = Testimonial.objects.all()
    serializer_class = TestimonialSerializer
    http_method_names = ['get', 'head', 'options', 'post', 'patch', 'delete']
    permission_classes = [StaffWritePermission]
    public_read = True
    public_create = True

    def get_queryset(self):
        """Get all testimonials ordered by creation date."""
        queryset = Testimonial.objects.all()
        if not (self.request.user and self.request.user.is_staff):
            queryset = queryset.filter(is_featured=True)
        return queryset.order_by('-created_at')

    def perform_update(self, serializer):
        serializer.save()

    def create(self, request, *args, **kwargs):
        """Handle testimonial creation by converting camelCase to snake_case."""
        import logging
        logger = logging.getLogger(__name__)
        
        data = dict(request.data)
        booking_reference = str(data.pop('booking_reference', '')).strip()
        email = str(data.get('email', '')).strip()
        booking = None
        if booking_reference and email:
            booking = Booking.objects.filter(
                reference__iexact=booking_reference,
                email__iexact=email,
                status=Booking.Status.CONFIRMED,
            ).first()
            if not booking:
                return Response(
                    {'detail': 'No confirmed booking matches that reference and email.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        if booking and booking.reviews.exists():
            return Response(
                {'detail': 'A review has already been submitted for this booking.'},
                status=status.HTTP_409_CONFLICT,
            )

        data.pop('isFeatured', None)
        data.pop('is_featured', None)
        
        serializer = self.get_serializer(data=data)
        if not serializer.is_valid():
            logger.error(f"[TESTIMONIAL] Validation errors: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        serializer.save(
            booking=booking,
            is_verified=booking is not None,
            is_featured=False,
        )
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def list(self, request, *args, **kwargs):
        """Override list to add logging."""
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"[TESTIMONIAL] Listing all testimonials")
        return super().list(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        """Handle testimonial update by converting camelCase to snake_case."""
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info(f"[TESTIMONIAL] Received update request for ID {kwargs.get('pk')}: {dict(request.data)}")
        # Convert isFeatured to is_featured
        data = dict(request.data)
        if 'isFeatured' in data:
            logger.info(f"[TESTIMONIAL] Found isFeatured: {data['isFeatured']}")
            data['is_featured'] = data.pop('isFeatured')
        logger.info(f"[TESTIMONIAL] Converted data: {data}")
        
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=data, partial=partial)
        if not serializer.is_valid():
            logger.error(f"[TESTIMONIAL] Validation errors: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        self.perform_update(serializer)
        logger.info(f"[TESTIMONIAL] Updated successfully ID: {instance.id}")
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def featured(self, request):
        """Get featured testimonials."""
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"[TESTIMONIAL] Fetching featured testimonials")
        featured = Testimonial.objects.filter(is_featured=True)
        serializer = self.get_serializer(featured, many=True)
        logger.info(f"[TESTIMONIAL] Found {len(serializer.data)} featured testimonials")
        return Response(serializer.data)



class PhotoThumbnailView(APIView):
    """Serve one stored photo of a visible safari or destination as a resized, cacheable JPEG."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    models = {'safaris': Safari, 'destinations': Destination}
    max_width = 900

    def get(self, request, kind, pk, index):
        model = self.models.get(kind)
        item = model.objects.filter(pk=pk, visible=True).first() if model else None
        images = (item.images or []) if item else []
        if index >= len(images) or not str(images[index]).startswith('data:image/'):
            return HttpResponse(status=404)
        try:
            image = Image.open(io.BytesIO(base64.b64decode(images[index].split(',', 1)[1])))
            image.thumbnail((self.max_width, self.max_width))
            buffer = io.BytesIO()
            image.convert('RGB').save(buffer, 'JPEG', quality=78, optimize=True, progressive=True)
        except Exception:
            return HttpResponse(status=404)
        response = HttpResponse(buffer.getvalue(), content_type='image/jpeg')
        response['Cache-Control'] = 'public, max-age=31536000, immutable'
        return response
