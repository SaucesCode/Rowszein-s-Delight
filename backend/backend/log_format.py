"""One JSON object per log line, with an allow-list of fields.

Only the fields below are ever written, so a password, token or request
object passed by mistake can never reach the logs.
"""
import json
import logging
from datetime import datetime, timezone

ALLOWED_EXTRAS = ("request_id", "actor_id", "retry_seconds", "identified", "status_code")


class JsonFormatter(logging.Formatter):
    def format(self, record):
        entry = {
            "time": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        for field in ALLOWED_EXTRAS:
            value = getattr(record, field, None)
            if isinstance(value, (str, int, float, bool)):
                entry[field] = value
        if record.exc_info:
            entry["error"] = record.exc_info[0].__name__ if record.exc_info[0] else "Exception"
        return json.dumps(entry, ensure_ascii=False)
