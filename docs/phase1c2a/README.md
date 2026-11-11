# Package 1C.2A verification

See [the repair report](../PHASE1C2A_CACHE_IDENTITY_REPAIR_REPORT.md) for source
changes, before/after evidence, actual failures/skips, scope and commands.

`run_checks.py` creates new owned targets and retains all accepted settings,
ownership and migration-hash guards. It adds a current-package marker and writes
only this package's evidence. `cache_settings.py` has a distinct module name so
it can inherit the accepted verification settings without shadowing them.

The before mode records the unchanged frontend's three failed navigation
requirements plus one control; collection completion is not a passing result.
The final browser mode fails on any assertion or harness error. Faulted/delayed
GETs first receive an actually authorized response; no authenticator, CSRF,
permission or session implementation is mocked. Auth-transition checks retain
the mounted application/cache across logout/login and demotion.

The browser server's 25-row fixtures are isolated test boundaries, not persistent
demo data. All databases/containers/server processes/runtime directories are
owned and cleaned up. The existing Docker engine may remain running; no global
engine shutdown or unrelated-resource cleanup is performed.

`run_frontend.py` runs the nine new real QueryClient checks, 52 accepted frontend
tests, affected lint, full lint and TypeScript/build with an empty env directory.
Full lint's remaining out-of-scope failures are reported explicitly; they are
not hidden by the focused-lint result.

Historical evidence and assertions remain intact. Intermediate new runs are
retained and explained in the report. `verification-summary.json` compacts raw
results and preservation checks. `manifest.json` hashes verification files only
(excluding itself); local .gitattributes preserves their exact bytes. Source
and report versions are identified by the final local commit.
