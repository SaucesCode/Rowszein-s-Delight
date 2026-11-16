"""Unit tests for scripts/test_postgres.py. Run with: python scripts/test_test_postgres.py"""
import os
import re
import subprocess
import sys
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))
import test_postgres as runner  # noqa: E402

BACKEND = Path(__file__).resolve().parents[1] / "backend"


class RunnerTests(unittest.TestCase):
    def test_identity_matches_the_guard(self):
        name, password = runner.new_identity()
        other_name, other_password = runner.new_identity()
        self.assertRegex(name, r"^rowszein_phase1a_[0-9a-f]{32}$")
        self.assertNotEqual(name, other_name)
        self.assertNotEqual(password, other_password)
        self.assertGreaterEqual(len(password), 24)

    def test_free_port_is_in_range(self):
        self.assertTrue(1024 <= runner.free_port() <= 65535)

    def test_environment_opts_in_and_names_the_database(self):
        env = runner.test_environment("rowszein_phase1a_" + "a" * 32, 54321, "secret-password")
        self.assertEqual(env["ROWSZEIN_TEST_POSTGRES"], "1")
        self.assertEqual(env["ROWSZEIN_TEST_DB_NAME"], "rowszein_phase1a_" + "a" * 32)
        self.assertEqual(env["ROWSZEIN_TEST_DB_PORT"], "54321")
        self.assertEqual(env["ROWSZEIN_TEST_DB_PASSWORD"], "secret-password")
        self.assertEqual(env["DJANGO_SETTINGS_MODULE"], "backend.test_settings")

    def test_wait_gives_up_with_a_clear_message(self):
        with self.assertRaises(RuntimeError) as caught:
            runner.wait_until_ready(lambda: False, timeout=0.2, interval=0.05)
        self.assertIn("didn't start", str(caught.exception))

    def test_wait_returns_once_ready(self):
        answers = iter([False, False, True])
        calls = []

        def probe():
            calls.append(1)
            return next(answers)

        runner.wait_until_ready(probe, timeout=5, interval=0.01)
        self.assertEqual(len(calls), 3)

    def test_unsafe_path_is_still_refused(self):
        env = dict(os.environ, ROWSZEIN_TEST_POSTGRES="1")
        result = subprocess.run([str(runner.backend_python()), "manage.py", "test", "--settings=backend.test_settings"],
                                cwd=BACKEND, env=env, capture_output=True, text=True, timeout=120)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("no verified disposable ownership", result.stderr)

    def test_missing_docker_exits_2(self):
        with mock.patch.object(runner.shutil, "which", return_value=None), mock.patch("sys.stdout"):
            self.assertEqual(runner.main([]), 2)

    def test_docker_not_running_exits_2(self):
        failed = subprocess.CompletedProcess(["docker", "info"], 1, "", "Cannot connect")
        with mock.patch.object(runner.shutil, "which", return_value="docker"), \
                mock.patch.object(runner.subprocess, "run", return_value=failed), mock.patch("sys.stdout"):
            self.assertEqual(runner.main([]), 2)

    def test_container_is_stopped_when_the_tests_are_interrupted(self):
        calls = []

        def fake_run(command, **kwargs):
            calls.append(command)
            return subprocess.CompletedProcess(command, 0, "", "")

        with mock.patch.object(runner.shutil, "which", return_value="docker"), \
                mock.patch.object(runner.subprocess, "run", side_effect=fake_run), \
                mock.patch.object(runner, "wait_until_ready"), \
                mock.patch.object(runner, "run_tests", side_effect=KeyboardInterrupt), mock.patch("sys.stdout"):
            with self.assertRaises(KeyboardInterrupt):
                runner.main(["sales"])
        started = next(c for c in calls if c[:2] == ["docker", "run"])
        name = started[started.index("--name") + 1]
        self.assertTrue(re.fullmatch(r"rowszein-test-[0-9a-f]{32}", name))
        self.assertIn(["docker", "stop", name], [c[:3] for c in calls])


class HardeningTests(unittest.TestCase):
    def test_probe_asks_over_tcp_inside_the_container(self):
        seen = []

        def fake_run(command, **kwargs):
            seen.append((command, kwargs))
            return subprocess.CompletedProcess(command, 0, "", "")

        with mock.patch.object(runner.subprocess, "run", side_effect=fake_run):
            self.assertTrue(runner.database_ready("rowszein-test-x", "rowszein_phase1a_" + "a" * 32))
        command, kwargs = seen[0]
        self.assertEqual(command[:3], ["docker", "exec", "rowszein-test-x"])
        self.assertIn("pg_isready", command)
        self.assertEqual(command[command.index("-h") + 1], "127.0.0.1")
        self.assertIn("timeout", kwargs)

    def test_stuck_probe_counts_as_not_ready(self):
        with mock.patch.object(runner.subprocess, "run", side_effect=subprocess.TimeoutExpired("docker", 5)):
            self.assertFalse(runner.database_ready("c", "db"))

    def test_stuck_docker_counts_as_not_running(self):
        with (mock.patch.object(runner.shutil, "which", return_value="docker"),
              mock.patch.object(runner.subprocess, "run", side_effect=subprocess.TimeoutExpired("docker", 15)),
              mock.patch("sys.stdout")):
            self.assertEqual(runner.main([]), 2)

    def test_database_that_never_starts_exits_2_and_is_removed(self):
        calls = []

        def fake_run(command, **kwargs):
            calls.append(command)
            return subprocess.CompletedProcess(command, 0, "", "")

        with (mock.patch.object(runner.shutil, "which", return_value="docker"),
              mock.patch.object(runner.subprocess, "run", side_effect=fake_run),
              mock.patch.object(runner, "wait_until_ready", side_effect=RuntimeError("PostgreSQL didn't start within 60 seconds.")),
              mock.patch("sys.stdout") as out):
            self.assertEqual(runner.main([]), 2)
        printed = "".join(str(c.args[0]) for c in out.write.call_args_list if c.args)
        self.assertIn("didn't start", printed)
        self.assertTrue(any(c[:2] == ["docker", "stop"] for c in calls))


if __name__ == "__main__":
    unittest.main()
