"""Current-package evidence only; Vite envDir cannot discover project .env."""
import json
from pathlib import Path
import shutil
import subprocess
import time
from uuid import uuid4
ROOT=Path(__file__).resolve().parents[2]
folder=Path(__file__).parent/'evidence'/(time.strftime('%Y%m%d-%H%M%S')+'-frontend-'+uuid4().hex[:8])
folder.mkdir(parents=True)
runtime=ROOT/'.verification-runtime'/uuid4().hex
runtime.mkdir();empty=runtime/'empty-env';empty.mkdir()
config=runtime/'vite.verify.mjs'
config.write_text('import base from '+json.dumps(str(ROOT/'frontend/vite.config.ts').replace('\\','/'))+';\nexport default {...base,envDir:'+json.dumps(str(empty).replace('\\','/'))+'};',encoding='utf-8')
checks=[('csrf-transport',['node','--experimental-strip-types','docs/phase1b1/test_csrf_transport.mjs'],ROOT),
    ('operation-identity',['node','--experimental-strip-types','docs/phase1b1/test_operation_identity.mjs'],ROOT),
    ('stock-quantities',['node','--experimental-strip-types','docs/phase1a3/test_stock_preview.mjs'],ROOT),
    ('permissions',['node','--experimental-strip-types','docs/phase1b2/test_permissions.mjs'],ROOT),
    ('auth-lifecycle',['node','--experimental-strip-types','docs/phase1b3_static/test_auth_lifecycle.mjs'],ROOT),
    ('build',['npm.cmd','run','build','--','--config',str(config)],ROOT/'frontend'),
    ('affected-lint',['node','node_modules/eslint/bin/eslint.js','src/lib/authLifecycle.ts','src/services/auth.services.ts','src/hooks/useAuth.ts','src/pages/LoginPage.tsx'],ROOT/'frontend')]
results={}
try:
    for name,command,cwd in checks:
        result=subprocess.run(command,cwd=cwd,capture_output=True,text=True,encoding='utf-8')
        (folder/(name+'.txt')).write_text(result.stdout+result.stderr,encoding='utf-8')
        results[name]={'exit_code':result.returncode,'command':command}
        print(name+': '+str(result.returncode),flush=True)
finally:
    resolved=runtime.resolve()
    if resolved.parent!=(ROOT/'.verification-runtime').resolve() or len(resolved.name)!=32: raise RuntimeError('Unsafe cleanup target.')
    shutil.rmtree(resolved)
    results['cleanup']={'owned_runtime_removed':not resolved.exists()}
    (folder/'summary.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
print('Evidence: '+str(folder.relative_to(ROOT)),flush=True)
raise SystemExit(1 if any(value.get('exit_code',0) for value in results.values()) else 0)
