"""Audit-only disposable profile; retain all accepted ownership/hash guards."""
import json
import os
from pathlib import Path

marker = Path(os.environ['ROWSZEIN_VERIFY_MARKER'])
if json.loads(marker.read_text()).get('functional_audit_authorization') != 'Phase 1C.1 synthetic isolated verification of fdd46a3':
    raise RuntimeError('Missing current audit authorization.')
from verification_settings import *  # noqa: E402,F403
