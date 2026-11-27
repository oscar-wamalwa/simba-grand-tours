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
from .views import DestinationViewSet, SafariViewSet, BlogViewSet, SubscriberViewSet, ContactMessageViewSet, SettingsViewSet, TestimonialViewSet
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

router = DefaultRouter()
router.register(r'departures', TripDepartureViewSet, basename='departure')
router.register(r'bookings', BookingViewSet, basename='booking')
router.register(r'waitlist', WaitlistViewSet, basename='waitlist')
router.register(r'promocodes', PromoCodeViewSet, basename='promocode')
router.register(r'announcements', TripAnnouncementViewSet, basename='announcement')
router.register(r'destinations', DestinationViewSet, basename='destination')
router.register(r'safaris', SafariViewSet, basename='safari')
router.register(r'blogs', BlogViewSet, basename='blog')
router.register(r'subscribers', SubscriberViewSet, basename='subscriber')
router.register(r'contact-messages', ContactMessageViewSet, basename='contact-message')
router.register(r'testimonials', TestimonialViewSet, basename='testimonial')
router.register(r'settings', SettingsViewSet, basename='settings')

urlpatterns = [
    path('bookings/create/', BookingCreateView.as_view(), name='booking-create'),
    path('bookings/<str:reference>/status/', BookingStatusView.as_view(), name='booking-status'),
    path('payments/mpesa/callback/<str:token>/', MpesaCallbackView.as_view(), name='mpesa-callback'),
    *router.urls,
]

