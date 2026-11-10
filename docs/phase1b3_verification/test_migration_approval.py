"""Database-free negative tests for the narrowed revised-hash authorization."""
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch
from migration_approval import verify_migrations,NEW

ROOT=Path(__file__).resolve().parents[2]


class MigrationApprovalContracts(unittest.TestCase):
    def setUp(self):
        base=(ROOT/'.verification-runtime').resolve()
        base.mkdir(exist_ok=True)
        self.temp=tempfile.TemporaryDirectory(prefix='approval-',dir=base)
        def cleanup():
            if Path(self.temp.name).resolve().parent!=base: raise RuntimeError('Unsafe test cleanup target.')
            self.temp.cleanup()
        self.addCleanup(cleanup)
        self.root=Path(self.temp.name)
        self.originals={}
        for relative in ['docs/phase1b3_static/evidence/schema-manifest.json','docs/phase1b3_verification/corrected-migration-approval.json']:
            path=self.root/relative;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes((ROOT/relative).read_bytes())
        items=json.loads((ROOT/'docs/phase1b3_static/evidence/schema-manifest.json').read_text())['migrations']
        for item in items:
            path=item['file']
            self.originals[path]=subprocess.check_output(['git','show','30a9a61:'+path],cwd=ROOT)
            target=self.root/path;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes((ROOT/path).read_bytes())
        self.patch=patch('migration_approval.subprocess.check_output',side_effect=lambda args,**kw:self.originals[args[-1].split(':',1)[1]])
        self.patch.start();self.addCleanup(self.patch.stop)

    def test_exact_approved_revision_accepted(self):
        result=verify_migrations(self.root)
        self.assertEqual(result['backend/accounts/migrations/0003_session_security_guards.py'],NEW)

    def test_any_additional_0003_change_rejected(self):
        path=self.root/'backend/accounts/migrations/0003_session_security_guards.py'
        path.write_text(path.read_text()+'\n# unreviewed\n')
        with self.assertRaises(RuntimeError): verify_migrations(self.root)

    def test_0002_change_rejected(self):
        path=self.root/'backend/accounts/migrations/0002_auththrottlebucket_devicesession_user_session_epoch_and_more.py'
        path.write_text(path.read_text()+'\n# unreviewed\n')
        with self.assertRaises(RuntimeError): verify_migrations(self.root)

    def test_altered_approval_hash_rejected(self):
        path=self.root/'docs/phase1b3_verification/corrected-migration-approval.json'
        data=json.loads(path.read_text());data['approved_sha256_utf8_lf']='0'*64;path.write_text(json.dumps(data))
        with self.assertRaises(RuntimeError): verify_migrations(self.root)

    def test_missing_owner_record_rejected(self):
        (self.root/'docs/phase1b3_verification/corrected-migration-approval.json').unlink()
        with self.assertRaises(FileNotFoundError): verify_migrations(self.root)
