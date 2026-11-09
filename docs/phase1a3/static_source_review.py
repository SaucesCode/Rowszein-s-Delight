"""Read-only AST/Git review. No Django/database imports or migration execution."""
import ast
import json
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[2]
evidence = root/'docs/phase1a3/evidence'


def git(*args):
    return subprocess.check_output(['git', *args], cwd=root, text=True).splitlines()


paths = git('ls-files', '--cached', '--others', '--exclude-standard', '--', 'backend', 'docs/phase1a3')
python_files = [root/path for path in paths if path.endswith('.py')]
for path in python_files:
    ast.parse(path.read_text(encoding='utf-8-sig'), filename=str(path))
preserved = git('diff', '--name-only', '32d2df3', '--', 'docs/audit', 'docs/phase1a', 'docs/phase1a2')
assert not preserved, preserved
old_migrations_changed = [path for path in git('diff', '--name-only', '32d2df3', '--', 'backend') if '/migrations/' in path]
assert not old_migrations_changed, old_migrations_changed


def tests(path):
    tree = ast.parse(path.read_text(encoding='utf-8'))
    return {node.name: node for node in ast.walk(tree) if isinstance(node, ast.FunctionDef) and node.name.startswith('test_')}


def assertions(node):
    return [ast.dump(child) for child in ast.walk(node) if isinstance(child, ast.Call) and isinstance(child.func, ast.Attribute) and child.func.attr.startswith('assert')]


old = tests(root/'docs/phase1a2/pending_api_contracts.py')
new = tests(root/'backend/sales/test_release_blockers.py')
assert len(old) == len(new) == 10 and old.keys() == new.keys()
for name in old:
    assert assertions(old[name]) == assertions(new[name]), name
changed = sorted(set(git('diff', '--name-only') + git('ls-files', '--others', '--exclude-standard')))
summary = {
    'python_sources_parsed': len(python_files),
    'prior_evidence_changed': preserved,
    'existing_migrations_changed': old_migrations_changed,
    'ported_release_blockers': 10,
    'ported_assertions_unchanged': True,
    'new_api_and_concurrency_definitions': len(tests(root/'backend/sales/tests.py')),
    'api_tests_executed': False,
    'database_access': False,
    'files_changed': changed,
}
(evidence/'static-source-review.json').write_text(json.dumps(summary, indent=2), encoding='utf-8')
print(json.dumps({key: value for key, value in summary.items() if key != 'files_changed'}, indent=2))
