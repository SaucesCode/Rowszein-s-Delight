"""Read-only dependency/quality checks; never discover application .env."""
import importlib.metadata as metadata
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import sys
import time
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[2]
FOLDER = Path(__file__).parent/'evidence'/(time.strftime('%Y%m%d-%H%M%S')+'-static-'+uuid4().hex[:8])
FOLDER.mkdir(parents=True)
runtime = ROOT/'.verification-runtime'/uuid4().hex
runtime.mkdir()
empty = runtime/'empty-env'
empty.mkdir()
env = {k:v for k,v in os.environ.items() if not k.upper().startswith(('DB_','DATABASE','PG','POSTGRES','ROWSZEIN_',
    'SECRET','AUTH_','CSRF_','CORS_','SESSION_','VITE_','DJANGO_'))}
env.update(PYTHONDONTWRITEBYTECODE='1',PYTHONIOENCODING='utf-8')
config = runtime/'vite.audit.mjs'
config.write_text('import base from '+json.dumps(str(ROOT/'frontend/vite.config.ts').replace('\\','/'))+';\nexport default {...base,envDir:'+json.dumps(str(empty).replace('\\','/'))+'};',encoding='utf-8')
inventory = {'python':platform.python_version(),'backend_declared':(ROOT/'backend/requirements.txt').read_text(),
    'backend_installed':sorted([{'name':d.metadata['Name'],'version':d.version} for d in metadata.distributions()],key=lambda d:d['name'].lower()),
    'frontend_declared':json.loads((ROOT/'frontend/package.json').read_text()),
    'frontend_lock':json.loads((ROOT/'frontend/package-lock.json').read_text())['packages']['']}
(FOLDER/'inventory.json').write_text(json.dumps(inventory,indent=2),encoding='utf-8')
commands = [
    ('node-version',['node','--version'],ROOT),
    ('npm-installed',['npm.cmd','ls','--depth=0','--json'],ROOT/'frontend'),
    ('full-lint',['node','node_modules/eslint/bin/eslint.js','.','--format','json'],ROOT/'frontend'),
    ('build',['npm.cmd','run','build','--','--config',str(config)],ROOT/'frontend'),
    ('date-probes',['node','--experimental-strip-types','docs/phase1c1/date_probes.mjs'],ROOT),
    *[(name,['node','--experimental-strip-types',path],ROOT) for name,path in [
        ('csrf-transport','docs/phase1b1/test_csrf_transport.mjs'),('operation-identities','docs/phase1b1/test_operation_identity.mjs'),
        ('stock-preview','docs/phase1a3/test_stock_preview.mjs'),('permissions','docs/phase1b2/test_permissions.mjs'),
        ('session-lifecycle','docs/phase1b3_static/test_auth_lifecycle.mjs')]],
    # Advisory lookups live in run_dependencies.py with explicit public
    # endpoints and an owned temporary cache; keep static checks offline.
]
results = {}
try:
    for name,command,cwd in commands:
        child_env = dict(env)
        if name=='date-probes': child_env['TZ']='Asia/Manila'
        try:
            result = subprocess.run(command,cwd=cwd,env=child_env,capture_output=True,text=True,encoding='utf-8',timeout=180)
            (FOLDER/(name+('.json' if name in ['full-lint','npm-audit','pip-audit','npm-installed'] else '.txt'))).write_text(result.stdout,encoding='utf-8')
            (FOLDER/(name+'-stderr.txt')).write_text(result.stderr,encoding='utf-8')
            results[name]={'exit_code':result.returncode,'command':command}
        except subprocess.TimeoutExpired:
            results[name]={'timeout':True,'command':command}
        print(name+': '+json.dumps(results[name]),flush=True)
finally:
    target = runtime.resolve()
    assert target.parent==(ROOT/'.verification-runtime').resolve() and len(target.name)==32
    shutil.rmtree(target)
    results['cleanup']={'owned_runtime_removed':not target.exists()}
    (FOLDER/'summary.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
print('Evidence: '+str(FOLDER.relative_to(ROOT)),flush=True)
