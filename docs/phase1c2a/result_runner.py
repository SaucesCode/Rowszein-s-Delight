import json
import os
from pathlib import Path
import unittest
from django.test.runner import DiscoverRunner
from backend.verification_runner import EvidenceResult

class Result(EvidenceResult):
    def stopTestRun(self):
        path=Path(os.environ['ROWSZEIN_VERIFY_RESULTS']).resolve()
        if (Path(__file__).resolve().parent/'evidence') not in path.parents:
            raise RuntimeError('Unowned result path.')
        path.write_text(json.dumps(dict(tests_run=self.testsRun,outcomes=self.outcomes,failures=len(self.failures),
            errors=len(self.errors),skipped=len(self.skipped)),indent=2),encoding='utf-8')
        unittest.TextTestResult.stopTestRun(self)

class Runner(DiscoverRunner):
    def get_test_runner_kwargs(self):
        return {**super().get_test_runner_kwargs(),'resultclass':Result}

    def run_suite(self,suite,**kwargs):
        from business_compatibility import phase1a_cookie_fixtures
        with phase1a_cookie_fixtures():
            return super().run_suite(suite,**kwargs)
