"""
Django REST Framework serializers for Simba Grand Tours API.
"""

try:
    from rest_framework import serializers
except Exception:  # pragma: no cover - fallback for environments without DRF
    # Minimal fallback to allow static analysis or running outside Django/DRF.
    class _SerializerFallback:
        class ModelSerializer:
            pass
    serializers = _SerializerFallback()

from urllib.parse import urlparse

from django.utils import timezone

from .models import (
    Booking,
    Blog,
    ContactMessage,
    Passenger,
    PromoCode,
    Safari,
    Settings,
    Subscriber,
    Testimonial,
    TripAnnouncement,
    TripDeparture,
    WaitlistEntry,
)


class URLWithDefaultSchemeField(serializers.URLField):
    def to_internal_value(self, data):
        if isinstance(data, str):
            data = data.strip()
            if data and '://' not in data:
                data = f'https://{data}'
        return super().to_internal_value(data)


class SafariSerializer(serializers.ModelSerializer):
    """Serializer for Safari model."""
    
    class Meta:
        model = Safari
        fields = [
            'id', 'title', 'description', 'location', 'price', 'duration',
            'difficulty', 'images', 'videos', 'highlights', 'inclusions', 'exclusions',
            'itinerary', 'visible', 'is_signature', 'trip_type', 'trip_mode',
            'county', 'pickup_points', 'packing_checklist', 'is_featured',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
        extra_kwargs = {
            'is_signature': {'required': False}
        }

    def to_internal_value(self, data):
        # Convert camelCase to snake_case before processing
        converted = dict(data)
        if 'isSignature' in converted:
            converted['is_signature'] = converted.pop('isSignature')
        return super().to_internal_value(converted)

    def create(self, validated_data):
        is_signature = validated_data.pop('is_signature', False)
        return Safari.objects.create(is_signature=is_signature, **validated_data)

    def update(self, instance, validated_data):
        is_signature = validated_data.pop('is_signature', None)
        if is_signature is not None:
            instance.is_signature = is_signature
        return super().update(instance, validated_data)

    def validate_videos(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError('Videos must be a list of URLs.')
        for video_url in value:
            if not isinstance(video_url, str):
                raise serializers.ValidationError('Each video must be a URL string.')
            parsed_url = urlparse(video_url)
            if parsed_url.scheme not in ('http', 'https') or not parsed_url.netloc:
                raise serializers.ValidationError('Each video must use a valid http or https URL.')
        return value


class TripDepartureSerializer(serializers.ModelSerializer):
    seats_available = serializers.IntegerField(read_only=True)
    safari_title = serializers.CharField(source='safari.title', read_only=True)

    class Meta:
        model = TripDeparture
        fields = [
            'id', 'safari', 'safari_title', 'start_date', 'end_date',
            'seats_total', 'seats_available', 'price_kes', 'pickup_points',
            'pickup_time', 'is_open', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_start_date(self, value):
        if value < timezone.localdate():
            raise serializers.ValidationError('Trip departure date must be today or in the future.')
        return value

    def validate_seats_total(self, value):
        if self.instance and value < self.instance.seats_taken:
            raise serializers.ValidationError(
                f'Capacity cannot be lower than {self.instance.seats_taken} currently reserved spot(s).'
            )
        return value

    def validate(self, attrs):
        start_date = attrs.get('start_date', getattr(self.instance, 'start_date', None))
        end_date = attrs.get('end_date', getattr(self.instance, 'end_date', None))
        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError({'end_date': 'End date cannot be before start date.'})
        return attrs


class BookingCreateSerializer(serializers.Serializer):
    departure = serializers.PrimaryKeyRelatedField(queryset=TripDeparture.objects.all())
    full_name = serializers.CharField(max_length=255)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=30)
    payment_phone = serializers.CharField(max_length=30)
    participant_count = serializers.IntegerField(min_value=1, max_value=20)
    promo_code = serializers.CharField(max_length=40, required=False, allow_blank=True)
    passengers = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        allow_empty=True,
        max_length=20,
    )

    def validate(self, attrs):
        passengers = attrs.get('passengers') or []
        if len(passengers) != attrs['participant_count']:
            raise serializers.ValidationError({
                'passengers': 'Provide one passenger record per participant.'
            })
        for index, passenger in enumerate(passengers, start=1):
            name = passenger.get('full_name')
            name = name.strip() if isinstance(name, str) else ''
            if not name:
                raise serializers.ValidationError({
                    'passengers': f'Passenger {index} must include a full_name.'
                })
            if len(name) > 255:
                raise serializers.ValidationError({
                    'passengers': f'Passenger {index} name must be at most 255 characters.'
                })
        return attrs


class PassengerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Passenger
        fields = ['id', 'full_name', 'phone', 'emergency_contact']
        read_only_fields = fields


class BookingSerializer(serializers.ModelSerializer):
    passengers = PassengerSerializer(many=True, read_only=True)
    departure_date = serializers.DateField(source='departure.start_date', read_only=True)
    safari_title = serializers.CharField(source='departure.safari.title', read_only=True)

    class Meta:
        model = Booking
        fields = [
            'id', 'reference', 'departure', 'departure_date', 'safari_title',
            'full_name', 'email', 'phone', 'participant_count', 'amount_kes',
            'status', 'payment_phone', 'mpesa_receipt', 'expires_at', 'created_at',
            'passengers',
        ]
        read_only_fields = fields


class WaitlistEntrySerializer(serializers.ModelSerializer):
    safari_title = serializers.CharField(source='departure.safari.title', read_only=True)
    departure_date = serializers.DateField(source='departure.start_date', read_only=True)

    class Meta:
        model = WaitlistEntry
        fields = [
            'id', 'departure', 'safari_title', 'departure_date', 'full_name',
            'email', 'phone', 'participant_count', 'status', 'created_at',
        ]
        read_only_fields = ['id', 'status', 'created_at']


class TripAnnouncementSerializer(serializers.ModelSerializer):
    class Meta:
        model = TripAnnouncement
        fields = ['id', 'title', 'message', 'image', 'link_url', 'starts_at', 'ends_at', 'active', 'created_at']
        read_only_fields = ['id', 'created_at']

    def validate(self, attrs):
        starts_at = attrs.get('starts_at', getattr(self.instance, 'starts_at', None))
        ends_at = attrs.get('ends_at', getattr(self.instance, 'ends_at', None))
        if starts_at and ends_at and ends_at <= starts_at:
            raise serializers.ValidationError({'ends_at': 'Announcement end time must be after its start time.'})
        return attrs


class PromoCodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = PromoCode
        fields = [
            'id', 'code', 'discount_type', 'value', 'starts_at', 'ends_at',
            'max_uses', 'uses_count', 'min_participants', 'active',
        ]
        read_only_fields = ['id', 'uses_count']

    def validate(self, attrs):
        if 'code' in attrs:
            attrs['code'] = attrs['code'].strip().upper()
        discount_type = attrs.get(
            'discount_type',
            getattr(self.instance, 'discount_type', None),
        )
        value = attrs.get('value', getattr(self.instance, 'value', None))
        if value is not None and value <= 0:
            raise serializers.ValidationError({'value': 'Discount value must be greater than zero.'})
        if discount_type == PromoCode.DiscountType.PERCENT and value is not None and value > 100:
            raise serializers.ValidationError({'value': 'Percentage discounts cannot exceed 100%.'})
        starts_at = attrs.get('starts_at', getattr(self.instance, 'starts_at', None))
        ends_at = attrs.get('ends_at', getattr(self.instance, 'ends_at', None))
        if starts_at and ends_at and ends_at <= starts_at:
            raise serializers.ValidationError({'ends_at': 'Promo code end time must be after its start time.'})
        return attrs


class BlogSerializer(serializers.ModelSerializer):
    """Serializer for Blog model."""
    
    class Meta:
        model = Blog
        fields = [
            'id', 'title', 'category', 'author', 'location', 'content',
            'read_time', 'publish_date', 'status', 'image', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class SubscriberSerializer(serializers.ModelSerializer):
    """Serializer for Subscriber model."""
    
    class Meta:
        model = Subscriber
        fields = ['id', 'email', 'name', 'subscribed_at']
        read_only_fields = ['id', 'subscribed_at']


class ContactMessageSerializer(serializers.ModelSerializer):
    """Serializer for ContactMessage model."""

    # Accept camelCase from frontend and convert to snake_case
    fullName = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = ContactMessage
        fields = [
            'id', 'full_name', 'email', 'phone', 'subject', 'message',
            'read', 'read_at', 'submitted_at', 'fullName'
        ]
        read_only_fields = ['id', 'read_at', 'submitted_at']

    def __init__(self, *args, **kwargs):
        # Make all fields optional
        for field_name in ['full_name', 'email', 'phone', 'subject', 'message']:
            if field_name in self.fields:
                self.fields[field_name].required = False
                self.fields[field_name].allow_blank = True
                self.fields[field_name].allow_null = True
        super().__init__(*args, **kwargs)

    def to_internal_value(self, data):
        # Convert camelCase to snake_case for processing
        converted = data.copy()
        if 'fullName' in converted:
            converted['full_name'] = converted.pop('fullName')
        if 'submittedAt' in converted:
            converted['submitted_at'] = converted.pop('submittedAt')
        if 'readAt' in converted:
            converted['read_at'] = converted.pop('readAt')
        return super().to_internal_value(converted)

    def create(self, validated_data):
        full_name = validated_data.pop('full_name', '')
        # Set default email if not provided
        if not validated_data.get('email') or not validated_data.get('email').strip():
            validated_data['email'] = 'no-reply@simbagrandtours.com'
        instance = ContactMessage.objects.create(full_name=full_name, **validated_data)
        return instance


class SettingsSerializer(serializers.ModelSerializer):
    """Serializer for Settings model."""
    website = URLWithDefaultSchemeField(required=False)
    instagram = URLWithDefaultSchemeField(required=False, allow_blank=True, allow_null=True)
    facebook = URLWithDefaultSchemeField(required=False, allow_blank=True, allow_null=True)
    twitter = URLWithDefaultSchemeField(required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = Settings
        fields = [
            'id', 'site_name', 'site_email', 'site_phone', 'address',
            'website', 'instagram', 'facebook', 'twitter', 'whatsapp',
            'featured_testimonials', 'updated_at'
        ]
        read_only_fields = ['id', 'updated_at']


class TestimonialSerializer(serializers.ModelSerializer):
    """Serializer for Testimonial model."""

    # Accept camelCase from frontend and convert to snake_case
    # Make it bidirectional so it can be used for both input and output
    fullName = serializers.CharField(source='full_name', required=False, allow_blank=True)
    isFeatured = serializers.BooleanField(source='is_featured', required=False)

    class Meta:
        model = Testimonial
        fields = [
            'id', 'full_name', 'email', 'location', 'safari', 'rating',
            'message', 'is_featured', 'is_verified', 'booking', 'created_at',
            'fullName', 'isFeatured'
        ]
        read_only_fields = ['id', 'is_verified', 'booking', 'created_at']

    def get_fields(self):
        fields = super().get_fields()
        request = getattr(self, '_context', {}).get('request')
        if request and not (request.user and request.user.is_staff):
            fields['email'].write_only = True
            fields['booking'].write_only = True
        return fields

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Make all fields optional
        for field_name in ['full_name', 'email', 'location', 'safari', 'message']:
            if field_name in self.fields:
                self.fields[field_name].required = False
                self.fields[field_name].allow_blank = True
                self.fields[field_name].allow_null = True

    def to_internal_value(self, data):
        # Convert camelCase to snake_case for processing
        converted = data.copy()
        if 'fullName' in converted:
            converted['full_name'] = converted.pop('fullName')
        if 'createdAt' in converted:
            converted['created_at'] = converted.pop('createdAt')
        if 'isFeatured' in converted:
            converted['is_featured'] = converted.pop('isFeatured')
        return super().to_internal_value(converted)

    def create(self, validated_data):
        full_name = validated_data.pop('full_name', '')
        # Set default email if not provided
        if not validated_data.get('email') or not validated_data.get('email').strip():
            validated_data['email'] = 'no-reply@simbagrandtours.com'
        instance = Testimonial.objects.create(full_name=full_name, **validated_data)
        return instance

    def to_representation(self, instance):
        """Convert snake_case to camelCase for frontend compatibility."""
        data = super().to_representation(instance)
        # Add camelCase aliases for frontend
        data['fullName'] = data.get('full_name')
        data['isFeatured'] = data.get('is_featured')
        data['createdAt'] = data.get('created_at')
        return data


