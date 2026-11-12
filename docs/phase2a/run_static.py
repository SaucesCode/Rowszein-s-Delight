"""Run the accepted frontend suite, affected lint, and a clean-env build."""
import json
import os
from pathlib import Path
import subprocess
import sys
import time
from tempfile import TemporaryDirectory
from uuid import uuid4


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
FRONT = ROOT / 'frontend'
sys.path.insert(0, str(ROOT / 'docs/phase1c3a'))
from run_frontend import SUITES  # noqa: E402


def main():
    folder = HERE / 'evidence' / f'static-{time.strftime("%Y%m%d-%H%M%S")}-{uuid4().hex[:6]}'
    folder.mkdir(parents=True)
    runtime = ROOT / '.verification-runtime'
    runtime.mkdir(exist_ok=True)
    env = {key: value for key, value in os.environ.items() if not key.upper().startswith(
        ('DB_', 'DATABASE', 'PG', 'POSTGRES', 'ROWSZEIN_', 'SECRET', 'AUTH_', 'CSRF_', 'CORS_', 'SESSION_', 'VITE_', 'DJANGO_'))}
    changed = subprocess.check_output(['git', 'diff', '--name-only', '6b30b27', '--', 'frontend/src'], cwd=ROOT, text=True)
    untracked = subprocess.check_output(['git', 'ls-files', '--others', '--exclude-standard', '--', 'frontend/src'], cwd=ROOT, text=True)
    affected = sorted({path.removeprefix('frontend/') for path in (changed + '\n' + untracked).splitlines() if path.endswith(('.ts', '.tsx'))})
    results = {}
    with TemporaryDirectory(prefix='phase2a-build-', dir=runtime) as owned_dir:
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
            results[name] = result.returncode
            print(f'{name}: {result.returncode}', flush=True)
    (folder / 'summary.json').write_text(json.dumps({
        'results': results, 'lint_files': affected, 'owned_runtime_removed': not owned.exists(),
    }, indent=2), encoding='utf-8')
    print('Evidence: ' + str(folder.relative_to(ROOT)), flush=True)
    return int(any(code for name, code in results.items() if name != 'full-lint'))


if __name__ == '__main__':
    raise SystemExit(main())
