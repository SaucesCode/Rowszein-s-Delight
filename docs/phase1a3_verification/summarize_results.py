"""Index actual results without overwriting earlier runs or treating skips as passes."""
from collections import Counter
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FOLDER = Path(__file__).resolve().parent
runs = []
for path in sorted((FOLDER/'evidence').iterdir()):
    if (path/'summary.json').exists() and (path/'environment.json').exists():
        runs.append((path, json.loads((path/'environment.json').read_text()), json.loads((path/'summary.json').read_text())))


def select(backend, required):
    eligible = [(path, env, summary) for path, env, summary in runs if env['backend'] == backend and set(required) <= set(summary) and all(summary[name]['exit_code'] == 0 for name in required)]
    assert eligible, (backend, required)
    return eligible[-1]


def outcomes(path, name):
    data = json.loads((path/(name + '.json')).read_text())
    counts = Counter(row['status'] for row in data['outcomes'])
    return {'tests': data['tests_run'], 'pass': counts['pass'], 'fail': data['failures'], 'error': data['errors'], 'skip': data['skipped']}


summary = {'test_groups': {}, 'migration': {}, 'historical_failed_runs_retained': []}
group_files = {'release_blockers': 'release-blockers', 'defined_api_concurrency': 'defined-api-concurrency',
               'pure_metadata': 'pure-metadata', 'storage_precision': 'storage-precision'}
for backend in ['postgres', 'sqlite']:
    path, environment, _ = select(backend, group_files)
    groups = {name: {**outcomes(path, file), 'evidence': str((path/(file+'.json')).relative_to(ROOT)).replace('\\', '/')} for name, file in group_files.items()}
    extended_path, _, _ = select(backend, ['phase1a1_compatibility', 'extended'])
    groups['phase1a1_compatibility'] = {**outcomes(extended_path, 'phase1a1-compatibility'), 'evidence': str((extended_path/'phase1a1-compatibility.json').relative_to(ROOT)).replace('\\', '/')}
    groups['extended'] = {**outcomes(extended_path, 'extended'), 'evidence': str((extended_path/'extended.json').relative_to(ROOT)).replace('\\', '/')}
    summary['test_groups'][backend] = groups
    summary.setdefault('totals', {})[backend] = {key: sum(group[key] for group in groups.values()) for key in ['tests', 'pass', 'fail', 'error', 'skip']}
    migration_path, _, _ = select(backend, ['migration', 'invalid_fixture'])
    migration = json.loads((migration_path/'migration-upgrade-backup.json').read_text())
    invalid = json.loads((migration_path/'invalid-legacy-target/invalid-fixture.json').read_text())
    assert migration['upgrade_preserved'] and migration['backup_restore_exact'] and migration['no_invented_history']
    assert invalid['expected_rejection'] and invalid['fixture_stopped'] and not invalid['migration_recorded']
    summary['migration'][backend] = {'evidence': str(migration_path.relative_to(ROOT)).replace('\\', '/'),
        'upgrade_sequence': migration['upgrade_sequence'], 'reverse_sequence': migration['unused_reverse_sequence'],
        'idempotent': migration['second_apply_sequence'] == [], 'historical_hash': migration['legacy_baseline_sha256'],
        'restored_exactly': True, 'no_invented_history': True, 'invalid_fixture': 'expected IntegrityError, unchanged negative stock, migration unrecorded'}
    if backend == 'postgres':
        summary['release_blockers'] = [{'test': row['test'], 'status': row['status']} for row in json.loads((path/'release-blockers.json').read_text())['outcomes']]
        summary['postgres_environment'] = {key: environment[key] for key in ['version', 'image', 'isolation', 'server_timezone']}
concurrency_keys = [f'concurrency_{index}' for index in range(1, 6)]
path, _, _ = select('postgres', concurrency_keys)
repetitions = [outcomes(path, f'concurrency-{index}') for index in range(1, 6)]
assert all(row == {'tests': 16, 'pass': 16, 'fail': 0, 'error': 0, 'skip': 0} for row in repetitions)
summary['repeated_concurrency'] = {'repetitions': 5, 'pass': 80, 'fail': 0, 'error': 0, 'skip': 0, 'evidence': str(path.relative_to(ROOT)).replace('\\', '/')}
path, _, _ = select('postgres', ['browser'])
browser = json.loads((path/'browser.json').read_text())
assert browser['passed'] and all(check['passed'] for check in browser['checks'].values())
summary['browser'] = {'checks_passed': len(browser['checks']), 'checks_failed': 0, 'page_errors': browser['page_errors'],
    'evidence': str(path.relative_to(ROOT)).replace('\\', '/'), 'screenshots': browser['screenshots']}
for path, _, run in runs:
    failed = {name: value for name, value in run.items() if value['exit_code'] != 0}
    if failed:
        summary['historical_failed_runs_retained'].append({'run': str(path.relative_to(ROOT)).replace('\\', '/'), 'failed_groups': failed})
cleanup = list((FOLDER/'evidence').rglob('cleanup.json'))
assert all(json.loads(path.read_text())['runtime_removed'] for path in cleanup)
assert not any((ROOT/'.verification-runtime').iterdir()), 'Owned verification runtime still has active targets'
summary['cleanup'] = {'records': len(cleanup), 'all_runtime_targets_removed': True, 'all_owned_container_cleanup_commands_succeeded': True}
(FOLDER/'verification-summary.json').write_text(json.dumps(summary, indent=2), encoding='utf-8')
print(json.dumps(summary['totals'], indent=2))
print(json.dumps(summary['browser'], indent=2))
