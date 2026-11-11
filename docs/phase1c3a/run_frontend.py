"""Preserve accepted frontend tests and use a clean env directory for the build."""
import json
import os
from pathlib import Path
import subprocess
import time
from tempfile import TemporaryDirectory
from uuid import uuid4


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
FRONT = ROOT / 'frontend'
SUITES = [
    'phase1c2a/test_query_identity.mjs', 'phase1c2b/test_listing_params.mjs',
    'phase1b1/test_csrf_transport.mjs', 'phase1b1/test_operation_identity.mjs',
    'phase1a3/test_stock_preview.mjs', 'phase1b2/test_permissions.mjs',
    'phase1b3_static/test_auth_lifecycle.mjs', 'phase1c3a/test_date_ranges.mjs',
]


def main():
    folder = HERE / 'evidence' / f'{time.strftime("%Y%m%d-%H%M%S")}-frontend-{uuid4().hex[:8]}'
    folder.mkdir(parents=True)
    runtime = ROOT / '.verification-runtime'
    runtime.mkdir(exist_ok=True)
    env = {key: value for key, value in os.environ.items() if not key.upper().startswith(
        ('DB_', 'DATABASE', 'PG', 'POSTGRES', 'ROWSZEIN_', 'SECRET', 'AUTH_', 'CSRF_', 'CORS_', 'SESSION_', 'VITE_', 'DJANGO_'))}
    results = {}
    changed = subprocess.check_output(['git', 'diff', '--name-only', '3934b74', '--', 'frontend/src'], cwd=ROOT, text=True)
    untracked = subprocess.check_output(['git', 'ls-files', '--others', '--exclude-standard', '--', 'frontend/src'], cwd=ROOT, text=True)
    affected = sorted({path.removeprefix('frontend/') for path in (changed + '\n' + untracked).splitlines() if path.endswith(('.ts', '.tsx'))})
    with TemporaryDirectory(prefix='phase1c3a-build-', dir=runtime) as owned_dir:
        owned = Path(owned_dir)
        empty = owned / 'empty-env'
        empty.mkdir()
        config = owned / 'vite.verify.mjs'
        config.write_text(f'import base from {json.dumps((FRONT / "vite.config.ts").as_posix())};\n'
                          f'export default {{...base,envDir:{json.dumps(empty.as_posix())}}};', encoding='utf-8')
        checks = [(Path(suite).stem, ['node', '--experimental-strip-types', 'docs/' + suite], ROOT) for suite in SUITES]
        checks += [
            ('affected-lint', ['node', 'node_modules/eslint/bin/eslint.js', *affected], FRONT),
            ('full-lint', ['node', 'node_modules/eslint/bin/eslint.js', '.', '--format', 'json'], FRONT),
            ('build', ['npm.cmd', 'run', 'build', '--', '--config', str(config)], FRONT),
        ]
        for name, command, cwd in checks:
            result = subprocess.run(command, cwd=cwd, env=env, capture_output=True, text=True, encoding='utf-8')
            (folder / (name + '.txt')).write_text(result.stdout + result.stderr, encoding='utf-8')
            results[name] = {'exit_code': result.returncode}
            print(f'{name}: {result.returncode}', flush=True)
    results['cleanup'] = {'owned_runtime_removed': not owned.exists()}
    (folder / 'summary.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
    print('Evidence: ' + str(folder.relative_to(ROOT)), flush=True)
    return int(any(result.get('exit_code') for name, result in results.items() if name != 'full-lint'))


if __name__ == '__main__':
    raise SystemExit(main())
