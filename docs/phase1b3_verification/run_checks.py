"""Explicit new approval + existing ownership harness. No ambient DB or .env."""
import argparse
import hashlib
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
spec=importlib.util.spec_from_file_location('owned_harness',ROOT/'docs/phase1a3_verification/run_verification.py')
harness=importlib.util.module_from_spec(spec)
spec.loader.exec_module(harness)


def approved_hashes():
    items=json.loads((ROOT/'docs/phase1b3_static/evidence/schema-manifest.json').read_text())['migrations']
    result={}
    for item in items:
        original=subprocess.check_output(['git','show','30a9a61:'+item['file']],cwd=ROOT)
        expected=hashlib.sha256(original.replace(b'\r\n',b'\n')).hexdigest()
        actual=hashlib.sha256((ROOT/item['file']).read_text(encoding='utf-8-sig').encode()).hexdigest()
        if actual!=expected or actual!=item['sha256_utf8_lf']:
            raise RuntimeError('Migration no longer matches approved checkpoint.')
        result[item['file']]=actual
    return result


def child(env,folder,name,args):
    output=folder/(name+'.json')
    env=dict(env,ROWSZEIN_VERIFY_RESULTS=str(output.resolve()))
    completed=subprocess.run([sys.executable,'-B',*args],env=env,cwd=ROOT,capture_output=True,text=True,encoding='utf-8')
    log=completed.stdout+completed.stderr
    for key in ['ROWSZEIN_VERIFY_PASSWORD','ROWSZEIN_VERIFY_TOKEN','ROWSZEIN_SESSION_TEST_KEY','ROWSZEIN_RATE_TEST_KEY']:
        log=log.replace(env.get(key,'NEVER_MATCH_EMPTY_SECRET'), '[REDACTED]')
    (folder/(name+'.txt')).write_text(log,encoding='utf-8')
    summary=json.loads(output.read_text()) if output.exists() else {'missing_result':True}
    summary={key:value for key,value in summary.items() if key!='outcomes'}
    if 'checks' in summary:
        summary={'checks_run':len(summary['checks']),'passed':sum(bool(v) for v in summary['checks'].values()),'failure':summary.get('failure')}
    summary['exit_code']=completed.returncode
    print(name+': '+json.dumps(summary),flush=True)
    return summary


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--backend',choices=['sqlite','postgres'],required=True)
    parser.add_argument('--scope',choices=['preflight','schema','diagnostic','security','business','concurrency','rbac','browser','all'],default='security')
    args=parser.parse_args()
    hashes=approved_hashes()  # Before resource creation or migration execution.
    folder=HERE/'evidence'/(time.strftime('%Y%m%d-%H%M%S')+'-'+args.backend+'-'+args.scope+'-'+uuid4().hex[:8])
    folder.mkdir(parents=True)
    results={}
    with harness.disposable(args.backend,folder) as (env,runtime,container):
        if container:
            inspected=json.loads(harness.docker('inspect',container))[0]
            tmpfs=inspected['HostConfig'].get('Tmpfs',{})
            if set(tmpfs)!={'/var/lib/postgresql/data'} or inspected['HostConfig'].get('Binds'):
                raise RuntimeError('Explicit isolated tmpfs/mount verification failed.')
            required={'rw','nosuid','nodev','size=384m'}
            if not required.issubset(set(tmpfs['/var/lib/postgresql/data'].split(','))):
                raise RuntimeError('Unexpected tmpfs configuration.')
        # The reused harness retains its identity/secret/context/mount checks.
        # Add a separate current approval; do not remove the older guards.
        marker=runtime/'target.json'
        target=json.loads(marker.read_text())
        target.update(session_security_authorization='Phase 1B.3 disposable verification of 30a9a61',session_migration_hashes=hashes)
        marker.write_text(json.dumps(target),encoding='utf-8')
        env={key:value for key,value in env.items() if not key.startswith(('AUTH_','CSRF_','CORS_','SESSION_'))}
        env.update(DJANGO_SETTINGS_MODULE='verification_settings',PYTHONIOENCODING='utf-8',
            PYTHONPATH=os.pathsep.join(map(str,[HERE,ROOT/'docs/phase1b3_static',ROOT/'docs/phase1b2',ROOT/'docs/phase1b1',ROOT/'docs/phase1b',ROOT/'backend'])),
            ROWSZEIN_SESSION_TEST_KEY=secrets.token_urlsafe(48),ROWSZEIN_RATE_TEST_KEY=secrets.token_urlsafe(48))
        metadata=json.loads((folder/'environment.json').read_text())
        metadata.update(package='Phase 1B.3 disposable verification',approval_baseline='30a9a61',new_migration_hashes=hashes,
            additional_authorization_guard=True,settings='phase1b3_verification/verification_settings.py',dotenv_discovery=False)
        if container: metadata['verified_hostconfig_tmpfs']=tmpfs
        (folder/'environment.json').write_text(json.dumps(metadata,indent=2),encoding='utf-8')
        # Capture actual plan and SQL before any migration executes.
        for name,command in [('migration-plan',['showmigrations','--plan']),('schema-sql',['sqlmigrate','accounts','0002']),
                ('guard-sql',['sqlmigrate','accounts','0003'])]:
            results[name]=child(env,folder,name,[str(ROOT/'backend/manage.py'),*command,'--settings=verification_settings'])
            if results[name]['exit_code']: raise RuntimeError('Pre-execution SQL/plan review failed.')
        if args.scope!='preflight':
            review=json.loads((HERE/'sql-review.json').read_text())
            for name in ('schema-sql','guard-sql'):
                digest=hashlib.sha256((folder/(name+'.txt')).read_bytes()).hexdigest()
                if digest!=review[args.backend][name]: raise RuntimeError('Generated SQL differs from reviewed preflight.')
        if args.scope in ['schema','all']:
            results['schema']=child(env,folder,'schema',[str(HERE/'schema_checks.py')])
        groups={
            'diagnostic':['operational_cases'],
            'security':['session_api_contracts','security_compatibility','operational_cases'],
            'business':['sales'],
            'concurrency':['session_concurrency','sales.tests.SalesConcurrencyTests','sales.test_verification_extended.ExtendedConcurrencyTests','rbac_compatibility.RBACConcurrencyTests'],
            'rbac':['rbac_compatibility.RBACRegressions'],
        }
        for scope,labels in groups.items():
            if args.scope in [scope,'all']:
                results[scope]=child(env,folder,scope,[str(ROOT/'backend/manage.py'),'test',*labels,'--settings=verification_settings',
                    '--testrunner=result_runner.Runner','--verbosity=2','--noinput'])
        if args.scope=='browser': results['browser']=child(env,folder,'browser',[str(HERE/'browser_checks.py')])
    (folder/'summary.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
    print('Evidence: '+str(folder.relative_to(ROOT)),flush=True)
    sys.exit(0 if all(item['exit_code']==0 for item in results.values()) else 1)
