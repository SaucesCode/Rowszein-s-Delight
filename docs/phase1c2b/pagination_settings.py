import json
import os
from pathlib import Path
if json.loads(Path(os.environ['ROWSZEIN_VERIFY_MARKER']).read_text()).get('pagination_authorization')!='Phase 1C.2B based on 98e29bf':
    raise RuntimeError('Missing package authorization.')
from cache_settings import *  # noqa: E402,F403
