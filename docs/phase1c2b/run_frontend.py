"""No package changes, no project dotenv discovery, new evidence only."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import time
from uuid import uuid4
ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).parent
folder=HERE/'evidence'/(time.strftime('%Y%m%d-%H%M%S')+'-frontend-'+uuid4().hex[:8])
folder.mkdir(parents=True)
runtime=ROOT/'.verification-runtime'/uuid4().hex
runtime.mkdir()
empty=runtime/'empty-env'
empty.mkdir()
config=runtime/'vite.verify.mjs'
config.write_text('import base from '+json.dumps(str(ROOT/'frontend/vite.config.ts').replace('\\','/'))+';\nexport default {...base,envDir:'+json.dumps(str(empty).replace('\\','/'))+'};',encoding='utf-8')
env={k:v for k,v in os.environ.items() if not k.upper().startswith(('DB_','DATABASE','PG','POSTGRES','ROWSZEIN_',
    'SECRET','AUTH_','CSRF_','CORS_','SESSION_','VITE_','DJANGO_'))}
env.update(PYTHONDONTWRITEBYTECODE='1',PYTHONIOENCODING='utf-8')
units=[('query-identity','docs/phase1c2a/test_query_identity.mjs'),('csrf-transport','docs/phase1b1/test_csrf_transport.mjs'),
    ('operation-identity','docs/phase1b1/test_operation_identity.mjs'),('stock-preview','docs/phase1a3/test_stock_preview.mjs'),
    ('permissions','docs/phase1b2/test_permissions.mjs'),('auth-lifecycle','docs/phase1b3_static/test_auth_lifecycle.mjs')]
units.append(('listing-params','docs/phase1c2b/test_listing_params.mjs'))
changed=subprocess.check_output(['git','diff','--name-only','98e29bf','--','frontend/src'],cwd=ROOT,text=True).splitlines()
untracked=subprocess.check_output(['git','ls-files','--others','--exclude-standard','--','frontend/src'],cwd=ROOT,text=True).splitlines()
affected=sorted({name.removeprefix('frontend/') for name in changed+untracked if name.endswith(('.ts','.tsx'))})
checks=[(name,['node','--experimental-strip-types',file],ROOT) for name,file in units]+[
    ('affected-lint',['node','node_modules/eslint/bin/eslint.js',*affected],ROOT/'frontend'),
    ('full-lint',['node','node_modules/eslint/bin/eslint.js','.','--format','json'],ROOT/'frontend'),
    ('build',['npm.cmd','run','build','--','--config',str(config)],ROOT/'frontend')]
results={}
try:
    for name,command,cwd in checks:
        result=subprocess.run(command,cwd=cwd,env=env,capture_output=True,text=True,encoding='utf-8')
        (folder/(name+'.txt')).write_text(result.stdout+result.stderr,encoding='utf-8')
        results[name]={'exit_code':result.returncode,'command':command}
        print(name+': '+str(result.returncode),flush=True)
finally:
    target=runtime.resolve()
    assert target.parent==(ROOT/'.verification-runtime').resolve() and len(target.name)==32
    shutil.rmtree(target)
    results['cleanup']={'owned_runtime_removed':not target.exists()}
    (folder/'summary.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
    print('Evidence: '+str(folder.relative_to(ROOT)),flush=True)
raise SystemExit(1 if any(v.get('exit_code',0) for k,v in results.items() if k!='full-lint') else 0)
