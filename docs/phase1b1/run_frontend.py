"""Retain fresh results; never overwrite Phase 0/1A/audit evidence."""
import json
from pathlib import Path
import subprocess
import time
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[2]
folder = Path(__file__).parent/'evidence'/(time.strftime('%Y%m%d-%H%M%S')+'-frontend-'+uuid4().hex[:8])
folder.mkdir(parents=True)
checks = [
    ('csrf-transport', ['node', 'docs/phase1b1/test_csrf_transport.mjs'], ROOT),
    ('operation-identity', ['node', 'docs/phase1b1/test_operation_identity.mjs'], ROOT),
    ('stock-preview', ['node', 'docs/phase1a3/test_stock_preview.mjs'], ROOT),
    ('frontend-build', ['npm.cmd', 'run', 'build'], ROOT/'frontend'),
    ('affected-lint', ['node', 'node_modules/eslint/bin/eslint.js', 'src/lib/csrfTransport.ts', 'src/lib/operationIdentity.ts',
        'src/hooks/useAuth.ts', 'src/hooks/useIngredients.ts', 'src/hooks/useSales.ts', 'src/services/api.ts'], ROOT/'frontend'),
    ('full-lint', ['npm.cmd', 'run', 'lint'], ROOT/'frontend'),
]
results = {}
for name, command, cwd in checks:
    result = subprocess.run(command, cwd=cwd, capture_output=True, text=True)
    (folder/(name+'.txt')).write_text(result.stdout+result.stderr, encoding='utf-8')
    results[name] = {'exit_code':result.returncode, 'command':command}
    print(name+': '+str(result.returncode), flush=True)
(folder/'summary.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
print('Evidence: '+str(folder.relative_to(ROOT)), flush=True)
raise SystemExit(1 if any(value['exit_code'] for value in results.values()) else 0)
