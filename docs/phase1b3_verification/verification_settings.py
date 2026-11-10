"""Additional 1B.3 approval gate, retaining every previous ownership guard."""
import hashlib
import json
import os
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
marker=Path(os.environ.get('ROWSZEIN_VERIFY_MARKER','')).resolve()
if (ROOT/'.verification-runtime').resolve() not in marker.parents or not marker.is_file():
    raise RuntimeError('Verified disposable target required.')
target=json.loads(marker.read_text())
if target.get('session_security_authorization')!='Phase 1B.3 disposable verification of 30a9a61':
    raise RuntimeError('Explicit session migration authorization missing.')
approved=json.loads((ROOT/'docs/phase1b3_static/evidence/schema-manifest.json').read_text())['migrations']
for item in approved:
    digest=hashlib.sha256((ROOT/item['file']).read_text(encoding='utf-8-sig').encode()).hexdigest()
    if digest!=item['sha256_utf8_lf'] or target.get('session_migration_hashes',{}).get(item['file'])!=digest:
        raise RuntimeError('Unreviewed migration hash; rebuild/review before execution.')
from backend.disposable_verification_settings import *  # noqa: E402,F403

AUTH_SESSION_SIGNING_KEY=os.environ['ROWSZEIN_SESSION_TEST_KEY']
AUTH_SESSION_ENV='disposable'
AUTH_RATE_KEYS={'1':os.environ['ROWSZEIN_RATE_TEST_KEY']}
AUTH_RATE_LIMITS={'LA':5,'LI':20,'LR':60,'RR':30}
AUTH_MAX_BUCKET_ROWS=50000
AUTH_PROXY_MODE='direct'
AUTH_TRUSTED_PROXY_CIDRS=[]
CSRF_COOKIE_SECURE=False
SESSION_COOKIE_SECURE=False
