"""Uploaded photos on Cloudinary.

Render's disk is wiped on redeploy and Django only serves /media/ in DEBUG,
so photos must live elsewhere in production. This storage uploads through
Cloudinary's official SDK and serves each photo resized on the fly in the
best format and quality the visitor's browser accepts.
"""
import os
import uuid

import cloudinary
import cloudinary.exceptions
import cloudinary.uploader
import cloudinary.utils
from django.conf import settings
from django.core.files.storage import Storage
from django.utils.deconstruct import deconstructible
from rest_framework.exceptions import APIException

UPLOAD_TIMEOUT_SECONDS = 30


class PhotoStorageUnavailable(APIException):
    status_code = 503
    default_detail = "Couldn't save the photo right now. Try again in a moment."
    default_code = "photo_storage_unavailable"


@deconstructible
class CloudinaryMediaStorage(Storage):
    def __init__(self):
        cloudinary.config(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
            secure=True,
        )

    def _public_id(self, name: str) -> str:
        base, _ = os.path.splitext(name)
        return f"{settings.CLOUDINARY_FOLDER}/{base}"

    def get_available_name(self, name, max_length=None):
        # A short random suffix keeps names unique without asking Cloudinary first.
        directory, filename = os.path.split(name)
        base, extension = os.path.splitext(filename)
        suffix = f"-{uuid.uuid4().hex[:8]}{extension.lower()}"
        limit = (max_length or 100) - len(directory) - len(suffix) - 1
        return os.path.join(directory, f"{base[:max(limit, 1)]}{suffix}").replace("\\", "/")

    def _save(self, name, content):
        content.seek(0)
        try:
            cloudinary.uploader.upload(
                content,
                public_id=self._public_id(name),
                resource_type="image",
                overwrite=False,
                timeout=UPLOAD_TIMEOUT_SECONDS,
            )
        except (cloudinary.exceptions.Error, OSError) as error:
            raise PhotoStorageUnavailable() from error
        return name

    def exists(self, name):
        return False

    def url(self, name):
        url, _ = cloudinary.utils.cloudinary_url(
            self._public_id(name), secure=True, fetch_format="auto", quality="auto", width=800, crop="limit"
        )
        return url

    def delete(self, name):
        try:
            cloudinary.uploader.destroy(self._public_id(name), resource_type="image", invalidate=True)
        except cloudinary.exceptions.Error as error:
            raise PhotoStorageUnavailable() from error
