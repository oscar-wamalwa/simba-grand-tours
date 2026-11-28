"""
Django REST Framework routers for Simba Grand Tours API.
"""

try:
	from rest_framework.routers import DefaultRouter  # type: ignore
except ImportError as e:
	raise ImportError(
		"djangorestframework is required to use API routing (rest_framework.routers.DefaultRouter). "
		"Install it with: pip install djangorestframework"
	) from e

from django.urls import path
from .views import (
    BlogCommentViewSet,
    BlogViewSet,
    ContactMessageViewSet,
    DestinationViewSet,
    PhotoThumbnailView,
    SafariViewSet,
    SettingsViewSet,
    SubscriberViewSet,
    TestimonialViewSet,
)
from .booking_views import (
    BookingCreateView,
    BookingStatusView,
    BookingViewSet,
    MpesaCallbackView,
    PromoCodeViewSet,
    TripAnnouncementViewSet,
    TripDepartureViewSet,
    WaitlistViewSet,
)
from .invoices import InvoiceViewSet

from .promo_pool_views import PromoPoolAdminViewSet, PromoPoolClaimView, PromoPoolStatusView
router = DefaultRouter()
router.register(r'departures', TripDepartureViewSet, basename='departure')
router.register(r'bookings', BookingViewSet, basename='booking')
router.register(r'invoices', InvoiceViewSet, basename='invoice')
router.register(r'waitlist', WaitlistViewSet, basename='waitlist')
router.register(r'promo-pool', PromoPoolAdminViewSet, basename='promo-pool')
router.register(r'promocodes', PromoCodeViewSet, basename='promocode')
router.register(r'announcements', TripAnnouncementViewSet, basename='announcement')
router.register(r'destinations', DestinationViewSet, basename='destination')
router.register(r'safaris', SafariViewSet, basename='safari')
router.register(r'blogs', BlogViewSet, basename='blog')
router.register(r'blog-comments', BlogCommentViewSet, basename='blog-comment')
router.register(r'subscribers', SubscriberViewSet, basename='subscriber')
router.register(r'contact-messages', ContactMessageViewSet, basename='contact-message')
router.register(r'testimonials', TestimonialViewSet, basename='testimonial')
router.register(r'settings', SettingsViewSet, basename='settings')

from .profile_views import AdminProfileView

urlpatterns = [
    path('auth/profile/', AdminProfileView.as_view(), name='admin-profile'),
    path('media/<str:kind>/<int:pk>/<int:index>/', PhotoThumbnailView.as_view(), name='photo-thumbnail'),
    path('promo-pool-public/status/', PromoPoolStatusView.as_view(), name='promo-pool-status'),
    path('promo-pool-public/claim/', PromoPoolClaimView.as_view(), name='promo-pool-claim'),
    path('bookings/create/', BookingCreateView.as_view(), name='booking-create'),
    path('bookings/<str:reference>/status/', BookingStatusView.as_view(), name='booking-status'),
    path('payments/mpesa/callback/<str:token>/', MpesaCallbackView.as_view(), name='mpesa-callback'),
    *router.urls,
]

