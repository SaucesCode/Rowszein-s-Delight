# Package 1B.1 disposable verification

[Review report](../PHASE1B1_CSRF_IMPLEMENTATION_REPORT.md) · [Actual selected results](verification-summary.json)

Run from the repository root using the existing backend environment and cached PostgreSQL 17 image. These commands require the owner's granted Package 1B.1 disposable testing authorization. They never authorize production access. Each runner creates fresh evidence directories and refuses arbitrary database targets; previous package evidence is preserved.

```powershell
.\backend\.venv\Scripts\python.exe -B docs/phase1b1/run_checks.py --backend postgres --scope all
.\backend\.venv\Scripts\python.exe -B docs/phase1b1/run_checks.py --backend sqlite --scope all
.\backend\.venv\Scripts\python.exe -B docs/phase1b1/run_checks.py --backend postgres --scope browser
.\backend\.venv\Scripts\python.exe -B docs/phase1b1/run_frontend.py
.\backend\.venv\Scripts\python.exe -B docs/phase1b1/static_review.py
.\backend\.venv\Scripts\python.exe -B docs/phase1b1/summarize_results.py
```

`all` deliberately returns exit 1: three deferred revocation/throttle requirements and all 13 unimplemented role requirements still fail. `security` runs the original 13 and 26 new cases; `before` exists for reproducing the pre-implementation baseline, and must be run on the baseline source to mean “before.” The summarizer selects completed runs with expected outcomes, lists every attempt and does not treat skips/errors/partial runs as passes. Full frontend lint also retains an unsuccessful exit.

The ownership-verified Phase 1A.3 harness/settings are reused without editing their source. Package metadata identifies this authorization separately. New wrappers permit HTTP CSRF cookies only after target ownership is validated; CSRF enforcement remains enabled. No project dotenv is loaded. Only existing migrations run, exclusively on newly owned targets. Browser fixtures are minimal isolated test data, not a Phase 2 data generator.

Browser lifecycle uses the webapp-testing skill's headless Playwright approach with custom exclusive ports (18841/18842/18843), fixture credentials, Windows environment/process-tree cleanup, external-network blocking and a separate hostile-Origin form server. Test ORM assertions run in a synchronous worker, preserving Django's async guard. Raw passwords/JWTs/CSRF values must not be written into browser traces; mutation tracing is limited to JSON business requests and records UUID/revision/payload/status only.

Do not rerun old evidence-overwriting audit scripts. Do not start Package 1B.2/1B.3 from these commands; this package ends at the owner-review checkpoint.
