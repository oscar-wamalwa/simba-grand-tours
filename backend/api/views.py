"""
Django REST Framework views for Simba Grand Tours API.
"""

import logging
import smtplib

from django.conf import settings
from django.core.mail import send_mail
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
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
from .models import Booking, Safari, Blog, Subscriber, ContactMessage, Settings, Testimonial
from .serializers import (
    SafariSerializer, BlogSerializer, SubscriberSerializer,
    ContactMessageSerializer, ContactMessageReplySerializer, SettingsSerializer, TestimonialSerializer
)

logger = logging.getLogger(__name__)


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
        queryset = Safari.objects.all()
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


class BlogViewSet(viewsets.ModelViewSet):
    """ViewSet for Blog CRUD operations."""
    queryset = Blog.objects.all()
    serializer_class = BlogSerializer
    permission_classes = [StaffWritePermission]
    public_read = True

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
        serializer.save()

    def perform_update(self, serializer):
        serializer.save(updated_at=timezone.now())


class SubscriberViewSet(viewsets.ModelViewSet):
    """ViewSet for Subscriber CRUD operations."""
    queryset = Subscriber.objects.all()
    serializer_class = SubscriberSerializer
    http_method_names = ['get', 'head', 'options', 'post', 'delete']  # No PUT/PATCH
    permission_classes = [StaffWritePermission]
    public_create = True

    def create(self, request, *args, **kwargs):
        """Handle subscriber creation with duplicate check."""
        email = request.data.get('email')
        if Subscriber.objects.filter(email=email).exists():
            return Response(
                {'detail': 'Email already subscribed'},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().create(request, *args, **kwargs)


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
                'website': 'https://www.simbagrandtours.com',
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
            queryset = queryset.filter(is_featured=True, is_verified=True)
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
        if not booking_reference or not email:
            return Response(
                {'detail': 'A confirmed booking reference and booking email are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
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
        if booking.reviews.exists():
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
        
        serializer.save(booking=booking, is_verified=True, is_featured=False)
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
        featured = Testimonial.objects.filter(is_featured=True, is_verified=True)
        serializer = self.get_serializer(featured, many=True)
        logger.info(f"[TESTIMONIAL] Found {len(serializer.data)} featured testimonials")
        return Response(serializer.data)

