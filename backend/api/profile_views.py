import base64
import binascii
import re

from rest_framework import permissions, serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AdminProfile

MAX_PHOTO_BYTES = 600_000


class AdminProfileSerializer(serializers.Serializer):
    username = serializers.CharField(read_only=True)
    display_name = serializers.CharField(max_length=80, allow_blank=True, required=False)
    photo = serializers.CharField(allow_blank=True, required=False, max_length=900_000)

    def validate_display_name(self, value):
        return value.strip()

    def validate_photo(self, value):
        if not value:
            return value
        match = re.fullmatch(r'data:image/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})', value)
        if not match:
            raise serializers.ValidationError('Use a JPEG, PNG, or WebP image.')
        try:
            data = base64.b64decode(match.group(2), validate=True)
        except (binascii.Error, ValueError) as error:
            raise serializers.ValidationError('The image data is invalid.') from error
        if len(data) > MAX_PHOTO_BYTES:
            raise serializers.ValidationError('The photo must be under 600 KB.')
        signatures = {
            'jpeg': data.startswith(b'\xff\xd8\xff'),
            'png': data.startswith(b'\x89PNG\r\n\x1a\n'),
            'webp': data.startswith(b'RIFF') and data[8:12] == b'WEBP',
        }
        if not signatures[match.group(1)]:
            raise serializers.ValidationError('The image content does not match its file type.')
        return value


class AdminProfileView(APIView):
    """Let the signed-in staff member read and edit their display name and photo."""

    permission_classes = [permissions.IsAdminUser]

    def _payload(self, user, profile):
        return {
            'username': user.get_username(),
            'display_name': profile.display_name,
            'photo': profile.photo,
        }

    def get(self, request):
        profile, _ = AdminProfile.objects.get_or_create(user=request.user)
        return Response(self._payload(request.user, profile))

    def patch(self, request):
        serializer = AdminProfileSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        profile, _ = AdminProfile.objects.get_or_create(user=request.user)
        for field in ('display_name', 'photo'):
            if field in serializer.validated_data:
                setattr(profile, field, serializer.validated_data[field])
        profile.save()
        return Response(self._payload(request.user, profile))
