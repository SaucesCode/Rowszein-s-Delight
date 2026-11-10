"""Exact browser-origin configuration; never infer production origins."""
from urllib.parse import urlsplit
from django.core.exceptions import ImproperlyConfigured


def exact_origins(value, setting_name):
    result = []
    for origin in value.split(','):
        origin = origin.strip()
        if not origin:
            continue
        try:
            parts = urlsplit(origin)
            parts.port
        except ValueError as error:
            raise ImproperlyConfigured(f'{setting_name} contains an invalid port') from error
        if ('*' in origin or parts.scheme not in {'http', 'https'} or not parts.hostname
                or parts.username is not None or parts.password is not None
                or parts.path or parts.query or parts.fragment):
            raise ImproperlyConfigured(f'{setting_name} requires exact scheme://host[:port] origins, without wildcards or paths')
        if parts.scheme == 'http' and parts.hostname not in {'localhost', '127.0.0.1', '::1'}:
            raise ImproperlyConfigured(f'{setting_name} permits HTTP only for explicit loopback development origins')
        if origin not in result:
            result.append(origin)
    return result
