"""NO DATABASE ACCESS: static checks, migration generation and pure tests only."""
from .test_settings import *  # noqa: F403

DATABASES = {'default': {'ENGINE': 'django.db.backends.dummy', 'NAME': ''}}
