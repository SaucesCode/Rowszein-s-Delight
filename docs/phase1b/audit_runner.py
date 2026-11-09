"""Reuse outcome capture, restrict new output to Phase 1B audit evidence."""
import json
import os
from pathlib import Path
import unittest
from backend.verification_runner import EvidenceResult, VerificationRunner


class AuditResult(EvidenceResult):
    def stopTestRun(self):
        path = Path(os.environ['ROWSZEIN_VERIFY_RESULTS']).resolve()
        root = Path(__file__).resolve().parent/'evidence'
        if root.resolve() not in path.parents:
            raise RuntimeError('Invalid Phase 1B evidence target')
        path.write_text(json.dumps({'tests_run': self.testsRun, 'outcomes': self.outcomes,
            'failures': len(self.failures), 'errors': len(self.errors), 'skipped': len(self.skipped)}, indent=2), encoding='utf-8')
        unittest.TextTestResult.stopTestRun(self)


class AuditRunner(VerificationRunner):
    def get_test_runner_kwargs(self):
        return {**super().get_test_runner_kwargs(), 'resultclass': AuditResult}
