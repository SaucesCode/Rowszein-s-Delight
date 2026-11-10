"""Per-test actual outcomes for the authorized disposable DB test runner."""
import json
import os
from pathlib import Path
import time
import unittest
from django.test.runner import DiscoverRunner


class EvidenceResult(unittest.TextTestResult):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.outcomes = []

    def startTest(self, test):
        self.started = time.monotonic()
        super().startTest(test)

    def record(self, test, status, detail=None):
        self.outcomes.append({'test': test.id(), 'status': status, 'detail': detail,
                              'seconds': round(time.monotonic() - self.started, 6)})

    def addSuccess(self, test):
        super().addSuccess(test)
        self.record(test, 'pass')

    def addFailure(self, test, err):
        super().addFailure(test, err)
        self.record(test, 'fail', self._exc_info_to_string(err, test))

    def addError(self, test, err):
        super().addError(test, err)
        self.record(test, 'error', self._exc_info_to_string(err, test))

    def addSkip(self, test, reason):
        super().addSkip(test, reason)
        self.record(test, 'skip', reason)

    def addSubTest(self, test, subtest, err):
        super().addSubTest(test, subtest, err)
        if err is not None:
            self.record(subtest, 'subtest_error', self._exc_info_to_string(err, subtest))

    def stopTestRun(self):
        output = Path(os.environ['ROWSZEIN_VERIFY_RESULTS']).resolve()
        allowed = Path(__file__).resolve().parents[2] / 'docs/phase1a3_verification/evidence'
        if allowed.resolve() not in output.parents:
            raise RuntimeError('Refusing evidence path outside verification folder')
        output.write_text(json.dumps({'tests_run': self.testsRun, 'outcomes': self.outcomes,
            'failures': len(self.failures), 'errors': len(self.errors), 'skipped': len(self.skipped)}, indent=2), encoding='utf-8')
        super().stopTestRun()


class VerificationRunner(DiscoverRunner):
    def get_test_runner_kwargs(self):
        return {**super().get_test_runner_kwargs(), 'resultclass': EvidenceResult}
