"""Public registries only, read-only advisories; no installation or audit fix."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time
from uuid import uuid4
ROOT=Path(__file__).resolve().parents[2]
folder=Path(__file__).parent/'evidence'/(time.strftime('%Y%m%d-%H%M%S')+'-dependencies-'+uuid4().hex[:8])
folder.mkdir(parents=True)
runtime=ROOT/'.verification-runtime'/uuid4().hex
runtime.mkdir()
env={k:v for k,v in os.environ.items() if not k.upper().startswith(('DB_','DATABASE','PG','POSTGRES','ROWSZEIN_',
    'SECRET','AUTH_','CSRF_','CORS_','SESSION_','VITE_','DJANGO_','PIP_','NPM_CONFIG_','NODE_AUTH_'))}
env.update(TMP=str(runtime),TEMP=str(runtime),PYTHONDONTWRITEBYTECODE='1',PYTHONIOENCODING='utf-8',PIP_INDEX_URL='https://pypi.org/simple')
checks=[('npm-audit',['npm.cmd','audit','--json','--ignore-scripts','--package-lock-only','--registry=https://registry.npmjs.org/'],ROOT/'frontend'),
    ('pip-audit',[sys.executable,'-B','-m','pip_audit','--local','--format=json','--progress-spinner=off','--cache-dir',str(runtime/'advisory-cache')],ROOT)]
results={}
try:
    for name,command,cwd in checks:
        result=subprocess.run(command,cwd=cwd,env=env,capture_output=True,text=True,encoding='utf-8',timeout=180)
        (folder/(name+'.json')).write_text(result.stdout,encoding='utf-8')
        (folder/(name+'-stderr.txt')).write_text(result.stderr,encoding='utf-8')
        results[name]={'exit_code':result.returncode,'command':command}
        print(name+': '+str(result.returncode),flush=True)
finally:
    resolved=runtime.resolve()
    assert resolved.parent==(ROOT/'.verification-runtime').resolve() and len(resolved.name)==32
    shutil.rmtree(resolved)
    results['cleanup']={'owned_runtime_removed':not resolved.exists()}
    (folder/'summary.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
    print('Evidence: '+str(folder.relative_to(ROOT)),flush=True)
