"""V2 cookie token codec. No token storage or legacy-token upgrade."""
import hmac
import re
import secrets
from uuid import UUID
import jwt
from django.conf import settings
from django.core import signing
from .session_errors import AuthUnavailable, SessionEnded
from .session_policy import access_expiry, numeric_date, jti_digest, MAX_INT


def signing_config():
    key = settings.AUTH_SESSION_SIGNING_KEY
    environment = settings.AUTH_SESSION_ENV
    if (not isinstance(key,str) or len(key) < 32 or not isinstance(environment,str)
            or not re.fullmatch(r'[a-z0-9_-]{1,32}', environment)):
        raise AuthUnavailable()
    return key, 'rowszein-auth:' + environment + ':v2', 'rowszein-api:' + environment


def decode(raw, kind, *, allow_expired=False):
    key, issuer, audience = signing_config()
    try:
        if not isinstance(raw,str) or len(raw)>4096:
            raise ValueError()
        data = jwt.decode(raw, key, algorithms=['HS256'], issuer=issuer, audience=audience,
            leeway=0, options={'verify_exp':not allow_expired, 'verify_iat':False, 'strict_aud':True,
                'require':['iss','aud','exp','iat','jti','sid','se','sv','user_id','token_type']})
        if (data['sv'] != 2 or type(data['sv']) is not int or data['token_type'] != kind
                or any(type(data[name]) is not int for name in ['user_id','se','iat','exp'])
                or not 1 <= data['se'] <= MAX_INT or not 1 <= data['user_id'] <= MAX_INT
                or not 0 <= data['iat'] < data['exp']
                or not isinstance(data['jti'], str) or not re.fullmatch(r'[A-Za-z0-9_-]{32,64}', data['jti'])):
            raise ValueError()
        data['sid'] = str(UUID(data['sid']))
        if kind == 'access' and data['exp'] - data['iat'] > 900:
            raise ValueError()
        if kind == 'refresh' and (type(data.get('rg')) is not int or not 0 <= data['rg'] <= MAX_INT
                or data['exp'] - data['iat'] > 28800):
            raise ValueError()
        return data
    except (jwt.PyJWTError, ValueError, TypeError, KeyError, AttributeError):
        raise SessionEnded() from None


def pair(session, now, refresh_jti):
    key, issuer, audience = signing_config()
    common = {'iss':issuer,'aud':audience,'sv':2,'sid':str(session.pk),'se':session.user_epoch,
        'user_id':session.user_id,'iat':numeric_date(now)}
    refresh = dict(common, token_type='refresh', rg=session.refresh_generation,
        exp=numeric_date(session.absolute_expires_at), jti=refresh_jti)
    access = dict(common, token_type='access', exp=access_expiry(now,session.absolute_expires_at), jti=secrets.token_urlsafe(32))
    if access['exp'] <= access['iat'] or refresh['exp'] <= refresh['iat']:
        raise SessionEnded()
    return {'access':jwt.encode(access,key,algorithm='HS256'), 'refresh':jwt.encode(refresh,key,algorithm='HS256'),
        'access_exp':access['exp'],'refresh_exp':refresh['exp'],'issued_at':numeric_date(now),
        'locator':signing.dumps({'sid':str(session.pk)}, salt='accounts.device-locator.v2')}


def locator_sid(raw):
    if not isinstance(raw,str) or len(raw)>512:
        return None
    try:
        data = signing.loads(raw or '', salt='accounts.device-locator.v2', max_age=28800)
        return str(UUID(data['sid']))
    except (signing.BadSignature, ValueError, TypeError, KeyError, AttributeError):
        return None


def current_refresh(session, claims):
    return claims['rg'] == session.refresh_generation and hmac.compare_digest(session.refresh_jti_hash, jti_digest(claims['jti']))
