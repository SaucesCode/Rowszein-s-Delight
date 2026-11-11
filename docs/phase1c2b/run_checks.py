"""New evidence/targets; reuse accepted ownership and exact migration checks."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import time
from uuid import uuid4

ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).parent
OLD=ROOT/'docs/phase1b3_verification'
sys.path.insert(0,str(OLD))
spec=importlib.util.spec_from_file_location('accepted_checks',OLD/'run_checks.py')
accepted=importlib.util.module_from_spec(spec)
spec.loader.exec_module(accepted)

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--backend',choices=['postgres','sqlite'],required=True)
    parser.add_argument('--scope',choices=['before','browser','preservation','api'],required=True)
    parser.add_argument('--count',type=int,default=25)
    args=parser.parse_args()
    hashes=accepted.approved_hashes()
    folder=HERE/'evidence'/(time.strftime('%Y%m%d-%H%M%S')+'-'+args.backend+'-'+args.scope+'-'+str(args.count)+'-'+uuid4().hex[:8])
    folder.mkdir(parents=True)
    with accepted.harness.disposable(args.backend,folder) as (env,runtime,container):
        if container:
            info=json.loads(accepted.harness.docker('inspect',container))[0]['HostConfig']
            assert not info.get('Binds') and set(info.get('Tmpfs',{}))=={'/var/lib/postgresql/data'}
            assert {'rw','nosuid','nodev','size=384m'}<=set(info['Tmpfs']['/var/lib/postgresql/data'].split(','))
        marker=runtime/'target.json'
        target=json.loads(marker.read_text())
        target.update(session_security_authorization='Phase 1B.3 disposable verification of 30a9a61',
            session_migration_hashes=hashes,corrected_migration_owner_approval='2026-11-10 exact SQLite literal fix',
            functional_audit_authorization='Phase 1C.1 synthetic isolated verification of fdd46a3',
            cache_repair_authorization='Phase 1C.2A verification based on b990398',pagination_authorization='Phase 1C.2B based on 98e29bf')
        marker.write_text(json.dumps(target),encoding='utf-8')
        env={k:v for k,v in env.items() if not k.startswith(('AUTH_','CSRF_','CORS_','SESSION_'))}
        env.update(DJANGO_SETTINGS_MODULE='pagination_settings',PYTHONIOENCODING='utf-8',
            PYTHONPATH=os.pathsep.join(map(str,[HERE,ROOT/'docs/phase1c2a',ROOT/'docs/phase1c1',OLD,ROOT/'docs/phase1b3_static',
                ROOT/'docs/phase1b2',ROOT/'docs/phase1b1',ROOT/'docs/phase1b',ROOT/'backend'])),
            ROWSZEIN_SESSION_TEST_KEY=secrets.token_urlsafe(48),ROWSZEIN_RATE_TEST_KEY=secrets.token_urlsafe(48),
            ROWSZEIN_FIXTURE_COUNT=str(args.count),ROWSZEIN_CACHE_BEFORE='1' if args.scope=='before' else '0')
        metadata=json.loads((folder/'environment.json').read_text())
        metadata.update(package='Phase 1C.2B',baseline='98e29bf',scope=args.scope,new_migrations=False,
            accepted_migration_hashes=hashes,dotenv_discovery=False)
        (folder/'environment.json').write_text(json.dumps(metadata,indent=2),encoding='utf-8')
        output=folder/(args.scope+'.json')
        env['ROWSZEIN_VERIFY_RESULTS']=str(output.resolve())
        command=[sys.executable,'-B',str(HERE/'browser_checks.py')] if args.scope in ['before','browser'] else [
            sys.executable,'-B',str(ROOT/'backend/manage.py'),'test','sales','session_api_contracts','security_compatibility',
            'operational_cases','rbac_compatibility','session_concurrency','--settings=pagination_settings',
            '--testrunner=result_runner.Runner','--verbosity=2','--noinput']
        if args.scope=='api': command=[sys.executable,'-B',str(ROOT/'backend/manage.py'),'test','pagination_tests','--settings=pagination_settings','--testrunner=result_runner.Runner','--verbosity=2','--noinput']
        result=subprocess.run(command,cwd=ROOT,env=env,capture_output=True,text=True,encoding='utf-8')
        log=result.stdout+result.stderr
        for name in ['ROWSZEIN_VERIFY_PASSWORD','ROWSZEIN_VERIFY_TOKEN','ROWSZEIN_SESSION_TEST_KEY','ROWSZEIN_RATE_TEST_KEY']:
            log=log.replace(env.get(name,'NEVER_MATCH_EMPTY_SECRET'),'[REDACTED]')
        (folder/(args.scope+'.txt')).write_text(log,encoding='utf-8')
        data=json.loads(output.read_text()) if output.exists() else {'missing_result':True}
        summary={k:v for k,v in data.items() if k not in ['outcomes','observations','requests','screenshots']}
        if 'observations' in data:
            summary.update(checks=len(data['observations']),passed=sum(v['passed'] for v in data['observations'].values()),
                failed=sum(not v['passed'] for v in data['observations'].values()))
        summary['exit_code']=result.returncode
    (folder/'summary.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
    print(json.dumps(summary),flush=True)
    print('Evidence: '+str(folder.relative_to(ROOT)),flush=True)
    sys.exit(result.returncode)
