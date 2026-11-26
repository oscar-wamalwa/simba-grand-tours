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

from .views import SafariViewSet, BlogViewSet, SubscriberViewSet, ContactMessageViewSet, SettingsViewSet, TestimonialViewSet

router = DefaultRouter()
router.register(r'safaris', SafariViewSet, basename='safari')
router.register(r'blogs', BlogViewSet, basename='blog')
router.register(r'subscribers', SubscriberViewSet, basename='subscriber')
router.register(r'contact-messages', ContactMessageViewSet, basename='contact-message')
router.register(r'testimonials', TestimonialViewSet, basename='testimonial')
router.register(r'settings', SettingsViewSet, basename='settings')

urlpatterns = router.urls

