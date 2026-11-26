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

from .models import Safari, Blog, Subscriber, ContactMessage, Settings, Testimonial


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
            'difficulty', 'images', 'highlights', 'inclusions', 'exclusions',
            'itinerary', 'visible', 'is_signature',
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
            'message', 'is_featured', 'created_at', 'fullName', 'isFeatured'
        ]
        read_only_fields = ['id', 'created_at']

    def __init__(self, *args, **kwargs):
        # Make all fields optional
        for field_name in ['full_name', 'email', 'location', 'safari', 'message']:
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


