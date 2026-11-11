import json
import os
from pathlib import Path
from unittest import TextTestResult

from result_runner import Runner as PreservationRunner
from backend.verification_runner import EvidenceResult


class Result(EvidenceResult):
    def stopTestRun(self):
        path = Path(os.environ['ROWSZEIN_VERIFY_RESULTS']).resolve()
        if (Path(__file__).resolve().parent / 'evidence') not in path.parents:
            raise RuntimeError('Unowned result path.')
        path.write_text(json.dumps({
            'tests_run': self.testsRun, 'outcomes': self.outcomes, 'failures': len(self.failures),
            'errors': len(self.errors), 'skipped': len(self.skipped),
        }, indent=2), encoding='utf-8')
        TextTestResult.stopTestRun(self)


class Runner(PreservationRunner):
    def get_test_runner_kwargs(self):
        return {**super().get_test_runner_kwargs(), 'resultclass': Result}
