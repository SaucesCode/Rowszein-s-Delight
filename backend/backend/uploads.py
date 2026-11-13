"""Server-side checks for uploaded photos (donuts and ingredients)."""
from django.conf import settings
from rest_framework import serializers


def validate_photo(value):
    """Accept JPG, PNG or WEBP images up to PHOTO_MAX_BYTES; Pillow has already confirmed it is an image."""
    if value is None:
        return value
    if value.size > settings.PHOTO_MAX_BYTES:
        raise serializers.ValidationError('Choose a photo under 5 MB.')
    image_format = getattr(getattr(value, 'image', None), 'format', None)
    if image_format not in settings.PHOTO_FORMATS:
        raise serializers.ValidationError('Choose a JPG, PNG or WEBP photo.')
    return value
