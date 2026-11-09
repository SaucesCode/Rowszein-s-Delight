import json
import os
from pathlib import Path
import unittest
from backend.verification_runner import EvidenceResult, VerificationRunner


class PackageResult(EvidenceResult):
    def stopTestRun(self):
        path = Path(os.environ['ROWSZEIN_VERIFY_RESULTS']).resolve()
        if (Path(__file__).resolve().parent/'evidence') not in path.parents:
            raise RuntimeError('Invalid Package 1B.1 evidence path')
        path.write_text(json.dumps({'tests_run': self.testsRun, 'outcomes': self.outcomes,
            'failures': len(self.failures), 'errors': len(self.errors), 'skipped': len(self.skipped)}, indent=2), encoding='utf-8')
        unittest.TextTestResult.stopTestRun(self)


class PackageRunner(VerificationRunner):
    def get_test_runner_kwargs(self):
        return {**super().get_test_runner_kwargs(), 'resultclass': PackageResult}
