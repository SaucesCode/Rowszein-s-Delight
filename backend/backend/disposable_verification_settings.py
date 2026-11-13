"""Explicitly authorized Phase 1A.3 targets ONLY; never read a project .env."""
import hashlib
import json
import os
from pathlib import Path
import re

import decouple
from decouple import Config, RepositoryEmpty

_root = Path(__file__).resolve().parents[2]
_runtime = (_root / '.verification-runtime').resolve()
_marker = Path(os.environ.get('ROWSZEIN_VERIFY_MARKER', '')).resolve()
if _runtime not in _marker.parents or not _marker.is_file():
    raise RuntimeError('A verified disposable ownership marker is required')
_target = json.loads(_marker.read_text())
_token = os.environ.get('ROWSZEIN_VERIFY_TOKEN', '')
if len(_token) < 40 or hashlib.sha256(_token.encode()).hexdigest() != _target['token_hash']:
    raise RuntimeError('Disposable ownership token mismatch')
if _target.get('authorization') != 'Phase 1A.3 disposable verification only':
    raise RuntimeError('Disposable migration authorization missing')
if not re.fullmatch(r'[0-9a-f]{32}', _target['identity']):
    raise RuntimeError('Invalid disposable identity')

# Empty repository disables AutoConfig discovery of project/production .env.
decouple.config = Config(RepositoryEmpty())
os.environ.update(SECRET_KEY='disposable-verification-only-never-deploy-123456789', DEBUG='False',
    DATABASE_URL='sqlite:///:memory:', ALLOWED_HOSTS='localhost,127.0.0.1,testserver',
    CSRF_TRUSTED_ORIGINS='http://localhost:18841,http://127.0.0.1:18841',
    CORS_ALLOWED_ORIGINS='http://localhost:18841,http://127.0.0.1:18841',
    AUTH_COOKIE_SECURE='False', AUTH_COOKIE_SAMESITE='Lax', SECURE_SSL_REDIRECT='False')
from .settings import *  # noqa: E402,F403

PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']
CONN_MAX_AGE = 0
if _target['backend'] == 'postgres':
    if not _target.get('docker_verified') or _target['host'] != '127.0.0.1':
        raise RuntimeError('PostgreSQL host/container ownership not verified')
    _name = 'rowszein_verify_' + _target['identity']
    _user = 'verify_' + _target['identity']
    if _target['name'] != _name or _target['user'] != _user or not 1024 <= _target['port'] <= 65535:
        raise RuntimeError('Non-disposable PostgreSQL target refused')
    _password = os.environ.get('ROWSZEIN_VERIFY_PASSWORD', '')
    if len(_password) < 40:
        raise RuntimeError('Generated disposable credential missing')
    DATABASES = {'default': {'ENGINE': 'django.db.backends.postgresql', 'HOST': '127.0.0.1',
        'PORT': _target['port'], 'NAME': _name, 'USER': _user, 'PASSWORD': _password,
        'TEST': {'NAME': 'test_' + _name}, 'CONN_MAX_AGE': 0}}
elif _target['backend'] == 'sqlite':
    _name = Path(_target['name']).resolve()
    if _name.parent != _marker.parent or _name.name != 'isolated.sqlite3':
        raise RuntimeError('Non-disposable SQLite path refused')
    DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': str(_name),
        'TEST': {'NAME': str(_marker.parent / 'test.sqlite3')}}}
else:
    raise RuntimeError('Unknown disposable backend')
MEDIA_ROOT = str(_marker.parent / 'media')
STATIC_ROOT = str(_marker.parent / 'static')
STORAGES = {'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
            'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'}}
