"""Configuration inspection without .env discovery or database connections."""
import json
import os
from pathlib import Path
import sys
import time
from uuid import uuid4
from decouple import Config, RepositoryEmpty
import decouple
ROOT=Path(__file__).resolve().parents[2]
decouple.config=Config(RepositoryEmpty())
for key in list(os.environ):
    if key.upper().startswith(('DB_','DATABASE','PG','POSTGRES','SECRET','AUTH_','CSRF_','CORS_','SESSION_','DJANGO_')):
        del os.environ[key]
os.environ.update(SECRET_KEY='audit-configuration-only-'+'x'*40,DEBUG='False',DATABASE_URL='sqlite:///:memory:',DJANGO_SETTINGS_MODULE='backend.settings')
sys.path.insert(0,str(ROOT/'backend'))
import django
django.setup()
from django.conf import settings
from django.core.files.storage import storages
from django.db import connections
folder=Path(__file__).parent/'evidence'/(time.strftime('%Y%m%d-%H%M%S')+'-configuration-'+uuid4().hex[:8])
folder.mkdir(parents=True)
result={'configured_legacy_static_backend':settings.STATICFILES_STORAGE,
    'resolved_static_backend':storages['staticfiles'].__class__.__module__+'.'+storages['staticfiles'].__class__.__name__,
    'timezone':settings.TIME_ZONE,'pagination_size':settings.REST_FRAMEWORK['PAGE_SIZE'],
    'database_connections_opened':any(conn.connection is not None for conn in connections.all()),'dotenv_discovery':False}
(folder/'configuration.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result,indent=2))
