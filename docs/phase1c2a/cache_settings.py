"""Package authorization plus unchanged accepted disposable security guards."""
import json
import os
from pathlib import Path
marker=Path(os.environ['ROWSZEIN_VERIFY_MARKER'])
if json.loads(marker.read_text()).get('cache_repair_authorization')!='Phase 1C.2A verification based on b990398':
    raise RuntimeError('Missing current package authorization.')
from audit_settings import *  # noqa: E402,F403
