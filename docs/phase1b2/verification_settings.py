"""Only the ownership-verified loopback test profile permits HTTP cookies."""
from backend.disposable_verification_settings import *  # noqa: F403

# The imported profile verifies ownership before reaching this override.
# Browser verification is HTTP loopback only. Application defaults stay Secure.
CSRF_COOKIE_SECURE = False
