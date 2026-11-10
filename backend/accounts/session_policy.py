"""Database-free security arithmetic and input rules; no auth grants here."""
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import ipaddress
import unicodedata

MAX_INT = 2**63 - 1
ACCESS = timedelta(minutes=15)
IDLE = timedelta(minutes=30)
ABSOLUTE = timedelta(hours=8)
EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)
SCOPES = {'LA': (5, 300), 'LI': (20, 300), 'LR': (60, 60), 'RR': (30, 60)}
EVENT_CEILING = 1000


def micros(value):
    if value.tzinfo is None:
        raise ValueError('UTC-aware time required')
    elapsed = value - EPOCH
    return (elapsed.days * 86400 + elapsed.seconds) * 1_000_000 + elapsed.microseconds


def numeric_date(value):
    return micros(value) // 1_000_000


def eligible(session, user_epoch, now):
    return (session.revoked_at is None and session.user_epoch == user_epoch
        and session.created_at <= session.last_activity_at <= now
        and now < session.last_activity_at + IDLE and now < session.absolute_expires_at
        and session.absolute_expires_at == session.created_at + ABSOLUTE)


def access_expiry(now, absolute):
    return numeric_date(min(now + ACCESS, absolute))


def normalized_account(value):
    return unicodedata.normalize('NFKC', value.strip()).casefold()


def subject_digest(key, scope, value):
    return hmac.new(key.encode(), (scope + '\0' + value).encode(), hashlib.sha256).hexdigest()


def jti_digest(value):
    return hashlib.sha256(value.encode('ascii')).hexdigest()


def prune_events(events, updated_at, now, window):
    current = micros(now)
    if (not isinstance(events, list) or len(events) > EVENT_CEILING or now < updated_at
            or any(type(value) is not int or not 0 <= value <= current for value in events)
            or events != sorted(events)):
        raise ValueError('Invalid counter state or clock regression')
    return [value for value in events if value > current - window * 1_000_000]


def retry_seconds(events, limit, now, window):
    if len(events) < limit:
        return 0
    remaining = events[-limit] + window * 1_000_000 - micros(now)
    return max(1, (remaining + 999_999) // 1_000_000)


def canonical_ip(value):
    if not isinstance(value,str) or '%' in value:
        raise ValueError('Unscoped client IP required')
    address = ipaddress.ip_address(value)
    if isinstance(address, ipaddress.IPv6Address) and address.ipv4_mapped:
        address = address.ipv4_mapped
    return address.compressed


def client_ip(meta, mode, trusted_cidrs):
    peer = canonical_ip(meta.get('REMOTE_ADDR', ''))
    if mode == 'direct':
        return peer
    if mode != 'proxy' or not trusted_cidrs:
        raise ValueError('Verified ingress configuration required')
    networks = [ipaddress.ip_network(cidr) for cidr in trusted_cidrs]
    trusted = lambda value: any(ipaddress.ip_address(value) in net for net in networks)
    if not trusted(peer):
        raise ValueError('Untrusted proxy peer')
    raw = meta.get('HTTP_X_FORWARDED_FOR', '')
    parts = raw.split(',')
    if not raw or len(raw) > 1024 or len(parts) > 8:
        raise ValueError('Invalid proxy chain')
    chain = [canonical_ip(value.strip()) for value in parts] + [peer]
    while chain and trusted(chain[-1]):
        chain.pop()
    if not chain:
        raise ValueError('No verified client in chain')
    return chain[-1]
