"""Static checkpoint ONLY. The dummy backend cannot open or migrate a database."""
import sys
if any(arg in sys.argv for arg in ('test','migrate','flush','sqlmigrate','runserver','shell')):
    raise RuntimeError('No database execution is authorized for the session schema checkpoint.')
from .schema_review_settings import *  # noqa: F403,E402

DATABASES = {'default':{'ENGINE':'django.db.backends.dummy','NAME':''}}
AUTH_SESSION_SIGNING_KEY = 'static-only-session-key-0000000000000000000000000000'
AUTH_SESSION_ENV = 'static-checkpoint'
AUTH_RATE_KEYS = {'1':'static-only-throttle-key-000000000000000000000000000'}
AUTH_RATE_LIMITS = {'LA':5,'LI':20,'LR':60,'RR':30}
AUTH_MAX_BUCKET_ROWS = 50000
AUTH_PROXY_MODE = 'direct'
AUTH_TRUSTED_PROXY_CIDRS = []
