"""UNAPPLIED: vendor guards. No data repair, token conversion or ledger write.

SQLite enforcement additionally depends on the installed connection authorizer.
PostgreSQL uses ordinary invoker functions; table owners remain a trusted boundary.
"""
from django.db import migrations


PG_FUNCTIONS = {
    'accounts_security_epoch_direct': """
CREATE FUNCTION accounts_security_epoch_direct() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'security epoch is database controlled'; END; $$;
""",
    'accounts_security_epoch_guard': """
CREATE FUNCTION accounts_security_epoch_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'INSERT' THEN
   IF NEW.session_epoch <> 1 THEN RAISE EXCEPTION 'initial epoch must be one'; END IF;
   RETURN NEW;
 END IF;
 IF (NEW.password,NEW.role,NEW.is_active,NEW.is_staff,NEW.is_superuser)
      IS DISTINCT FROM (OLD.password,OLD.role,OLD.is_active,OLD.is_staff,OLD.is_superuser) THEN
   IF OLD.session_epoch >= 9223372036854775807 THEN RAISE EXCEPTION 'security epoch exhausted'; END IF;
   NEW.session_epoch := OLD.session_epoch + 1;
 END IF;
 RETURN NEW;
END; $$;
""",
    'accounts_security_epoch_revoke': """
CREATE FUNCTION accounts_security_epoch_revoke() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.session_epoch <> OLD.session_epoch THEN
  UPDATE accounts_devicesession SET revoked_at=clock_timestamp(), revocation_reason=
   CASE WHEN NEW.password IS DISTINCT FROM OLD.password THEN 'credentials_changed'
        WHEN NEW.role IS DISTINCT FROM OLD.role THEN 'role_changed' ELSE 'status_changed' END
   WHERE user_id=NEW.id AND revoked_at IS NULL;
 END IF;
 RETURN NEW;
END; $$;
""",
    'accounts_device_guard': """
CREATE FUNCTION accounts_device_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE epoch bigint; active boolean; business_role varchar; sampled timestamptz;
BEGIN
 IF TG_OP = 'INSERT' THEN
  SELECT session_epoch,is_active,role INTO epoch,active,business_role FROM accounts_user WHERE id=NEW.user_id FOR SHARE;
  sampled := clock_timestamp();
  IF epoch IS NULL OR NOT active OR business_role NOT IN ('admin','staff') OR NEW.user_epoch <> epoch
     OR NEW.refresh_generation <> 0 OR NEW.revoked_at IS NOT NULL OR NEW.created_at > sampled THEN
    RAISE EXCEPTION 'invalid initial device state';
  END IF;
  RETURN NEW;
 END IF;
 sampled := clock_timestamp();
 IF (NEW.id,NEW.user_id,NEW.user_epoch,NEW.created_at,NEW.absolute_expires_at)
      IS DISTINCT FROM (OLD.id,OLD.user_id,OLD.user_epoch,OLD.created_at,OLD.absolute_expires_at) THEN
  RAISE EXCEPTION 'immutable device identity';
 END IF;
 IF OLD.revoked_at IS NOT NULL THEN
  IF NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'revoked device is terminal'; END IF;
  RETURN NEW;
 END IF;
 IF NEW.last_activity_at < OLD.last_activity_at OR NEW.last_activity_at > sampled THEN
  RAISE EXCEPTION 'invalid device activity';
 END IF;
 IF NEW.refresh_generation = OLD.refresh_generation THEN
  IF NEW.refresh_jti_hash <> OLD.refresh_jti_hash THEN RAISE EXCEPTION 'refresh hash without generation'; END IF;
 ELSIF NEW.refresh_generation::numeric = OLD.refresh_generation::numeric + 1 THEN
  IF NEW.refresh_jti_hash = OLD.refresh_jti_hash THEN RAISE EXCEPTION 'generation without refresh hash'; END IF;
 ELSE RAISE EXCEPTION 'nonmonotonic refresh generation';
 END IF;
 IF NEW.revoked_at IS NOT NULL AND
     (NEW.last_activity_at,NEW.refresh_generation,NEW.refresh_jti_hash)
       IS DISTINCT FROM (OLD.last_activity_at,OLD.refresh_generation,OLD.refresh_jti_hash) THEN
  RAISE EXCEPTION 'revocation must preserve last applied device state';
 END IF;
 RETURN NEW;
END; $$;
""",
    'accounts_throttle_guard': """
CREATE FUNCTION accounts_throttle_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE item jsonb; prior numeric := -1; current_value numeric; max_value numeric;
BEGIN
 IF TG_OP = 'UPDATE' THEN
  IF (NEW.id,NEW.scope,NEW.key_version,NEW.subject_digest) IS DISTINCT FROM
     (OLD.id,OLD.scope,OLD.key_version,OLD.subject_digest) OR NEW.updated_at < OLD.updated_at THEN
   RAISE EXCEPTION 'invalid throttle identity or clock';
  END IF;
 END IF;
 IF jsonb_typeof(NEW.event_times) <> 'array' OR jsonb_array_length(NEW.event_times)>1000 THEN
  RAISE EXCEPTION 'invalid throttle array';
 END IF;
 max_value := floor(extract(epoch FROM NEW.updated_at)*1000000);
 FOR item IN SELECT value FROM jsonb_array_elements(NEW.event_times) LOOP
  IF jsonb_typeof(item) <> 'number' OR item::text !~ '^[0-9]+$' THEN RAISE EXCEPTION 'invalid throttle event'; END IF;
  current_value := item::text::numeric;
  IF current_value < prior OR current_value > max_value THEN RAISE EXCEPTION 'invalid throttle event order/time'; END IF;
  prior := current_value;
 END LOOP;
 RETURN NEW;
END; $$;
""",
}

PG_TRIGGERS = [
 ('accounts_security_epoch_direct','accounts_user','BEFORE UPDATE OF session_epoch','accounts_security_epoch_direct','STATEMENT'),
 ('accounts_security_epoch_guard','accounts_user','BEFORE INSERT OR UPDATE','accounts_security_epoch_guard','ROW'),
 ('accounts_security_epoch_revoke','accounts_user','AFTER UPDATE','accounts_security_epoch_revoke','ROW'),
 ('accounts_device_guard','accounts_devicesession','BEFORE INSERT OR UPDATE','accounts_device_guard','ROW'),
 ('accounts_throttle_guard','accounts_auththrottlebucket','BEFORE INSERT OR UPDATE','accounts_throttle_guard','ROW'),
]

SQLITE_TRIGGERS = {
 'accounts_security_epoch_insert': """
CREATE TRIGGER accounts_security_epoch_insert BEFORE INSERT ON accounts_user
WHEN NEW.session_epoch <> 1 BEGIN SELECT RAISE(ABORT,'initial epoch must be one'); END
""",
 'accounts_security_epoch_guard': """
CREATE TRIGGER accounts_security_epoch_guard BEFORE UPDATE ON accounts_user BEGIN
 SELECT CASE WHEN rs_guarded_connection() <> 1 THEN RAISE(ABORT,'guarded connection required') END;
 SELECT CASE WHEN (NEW.password IS NOT OLD.password OR NEW.role IS NOT OLD.role OR NEW.is_active IS NOT OLD.is_active
  OR NEW.is_staff IS NOT OLD.is_staff OR NEW.is_superuser IS NOT OLD.is_superuser)
  AND OLD.session_epoch >= 9223372036854775807 THEN RAISE(ABORT,'security epoch exhausted') END;
END
""",
 'accounts_security_epoch_bump': """
CREATE TRIGGER accounts_security_epoch_bump AFTER UPDATE OF password,role,is_active,is_staff,is_superuser ON accounts_user
WHEN NEW.password IS NOT OLD.password OR NEW.role IS NOT OLD.role OR NEW.is_active IS NOT OLD.is_active
 OR NEW.is_staff IS NOT OLD.is_staff OR NEW.is_superuser IS NOT OLD.is_superuser BEGIN
 UPDATE accounts_devicesession SET revoked_at=strftime('%Y-%m-%d %H:%M:%f','now') || '000',
  revocation_reason=CASE WHEN NEW.password IS NOT OLD.password THEN 'credentials_changed'
   WHEN NEW.role IS NOT OLD.role THEN 'role_changed' ELSE 'status_changed' END WHERE user_id=NEW.id AND revoked_at IS NULL;
 UPDATE accounts_user SET session_epoch=OLD.session_epoch+1 WHERE id=NEW.id;
END
""",
 'accounts_device_insert': """
CREATE TRIGGER accounts_device_insert BEFORE INSERT ON accounts_devicesession BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM accounts_user WHERE id=NEW.user_id AND is_active=1
  AND role IN ('admin','staff') AND session_epoch=NEW.user_epoch) OR NEW.refresh_generation<>0 OR NEW.revoked_at IS NOT NULL
  OR julianday(NEW.created_at)>julianday('now') THEN RAISE(ABORT,'invalid initial device state') END;
END
""",
 'accounts_device_update': """
CREATE TRIGGER accounts_device_update BEFORE UPDATE ON accounts_devicesession BEGIN
 SELECT CASE WHEN NEW.id IS NOT OLD.id OR NEW.user_id IS NOT OLD.user_id OR NEW.user_epoch IS NOT OLD.user_epoch
  OR NEW.created_at IS NOT OLD.created_at OR NEW.absolute_expires_at IS NOT OLD.absolute_expires_at
  THEN RAISE(ABORT,'immutable device identity') END;
 SELECT CASE WHEN OLD.revoked_at IS NOT NULL AND (NEW.revoked_at IS NOT OLD.revoked_at OR NEW.revocation_reason IS NOT OLD.revocation_reason
  OR NEW.last_activity_at IS NOT OLD.last_activity_at OR NEW.refresh_generation IS NOT OLD.refresh_generation
  OR NEW.refresh_jti_hash IS NOT OLD.refresh_jti_hash) THEN RAISE(ABORT,'revoked device is terminal') END;
 SELECT CASE WHEN NEW.last_activity_at < OLD.last_activity_at OR julianday(NEW.last_activity_at)>julianday('now')
  THEN RAISE(ABORT,'invalid device activity') END;
 SELECT CASE WHEN NOT ((NEW.refresh_generation=OLD.refresh_generation AND NEW.refresh_jti_hash=OLD.refresh_jti_hash)
  OR (OLD.refresh_generation<9223372036854775807 AND NEW.refresh_generation=OLD.refresh_generation+1 AND NEW.refresh_jti_hash<>OLD.refresh_jti_hash))
  THEN RAISE(ABORT,'nonmonotonic refresh generation') END;
 SELECT CASE WHEN NEW.revoked_at IS NOT NULL AND (NEW.last_activity_at IS NOT OLD.last_activity_at
  OR NEW.refresh_generation IS NOT OLD.refresh_generation OR NEW.refresh_jti_hash IS NOT OLD.refresh_jti_hash)
  THEN RAISE(ABORT,'revocation must preserve last applied device state') END;
END
""",
 'accounts_throttle_insert': """
CREATE TRIGGER accounts_throttle_insert BEFORE INSERT ON accounts_auththrottlebucket BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM json_each(NEW.event_times) e WHERE e.type<>'integer' OR e.value<0
  OR e.value>CAST(strftime('%s',substr(NEW.updated_at,1,19)) AS INTEGER)*1000000+
   CASE WHEN substr(NEW.updated_at,20,1)='.' THEN CAST(substr(substr(NEW.updated_at,21)||'000000',1,6) AS INTEGER) ELSE 0 END
  OR (CAST(e.key AS INTEGER)>0 AND e.value<json_extract(NEW.event_times,'$[' || (CAST(e.key AS INTEGER)-1) || ']')))
  THEN RAISE(ABORT,'invalid throttle events') END;
END
""",
 'accounts_throttle_update': """
CREATE TRIGGER accounts_throttle_update BEFORE UPDATE ON accounts_auththrottlebucket BEGIN
 SELECT CASE WHEN NEW.id IS NOT OLD.id OR NEW.scope IS NOT OLD.scope OR NEW.key_version IS NOT OLD.key_version
  OR NEW.subject_digest IS NOT OLD.subject_digest OR NEW.updated_at<OLD.updated_at THEN RAISE(ABORT,'invalid throttle identity or clock') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM json_each(NEW.event_times) e WHERE e.type<>'integer' OR e.value<0
  OR e.value>CAST(strftime('%s',substr(NEW.updated_at,1,19)) AS INTEGER)*1000000+
   CASE WHEN substr(NEW.updated_at,20,1)='.' THEN CAST(substr(substr(NEW.updated_at,21)||'000000',1,6) AS INTEGER) ELSE 0 END
  OR (CAST(e.key AS INTEGER)>0 AND e.value<json_extract(NEW.event_times,'$[' || (CAST(e.key AS INTEGER)-1) || ']')))
  THEN RAISE(ABORT,'invalid throttle events') END;
END
""",
}


def install(apps, schema_editor):
    vendor = schema_editor.connection.vendor
    if vendor == 'postgresql':
        # Explicitly require public tables/search path, rather than assuming a
        # provider's schema. Production provisioning is a separate approval.
        with schema_editor.connection.cursor() as cursor:
            cursor.execute('SELECT current_schema()')
            if cursor.fetchone()[0] != 'public':
                raise RuntimeError('Session guards require reviewed public schema.')
        for sql in PG_FUNCTIONS.values():
            schema_editor.execute(sql.replace('LANGUAGE plpgsql AS', 'LANGUAGE plpgsql SET search_path = public, pg_temp AS'))
        for name, table, event, function, level in PG_TRIGGERS:
            schema_editor.execute(f'CREATE TRIGGER {name} {event} ON public.{table} FOR EACH {level} EXECUTE FUNCTION public.{function}()')
    elif vendor == 'sqlite':
        for sql in SQLITE_TRIGGERS.values(): schema_editor.execute(sql)
    else:
        raise RuntimeError('Unreviewed session database backend.')


def uninstall(apps, schema_editor):
    vendor = schema_editor.connection.vendor
    if vendor == 'postgresql':
        for name,table,*_ in reversed(PG_TRIGGERS):
            schema_editor.execute(f'DROP TRIGGER {name} ON public.{table}')
        for name in reversed(PG_FUNCTIONS): schema_editor.execute(f'DROP FUNCTION public.{name}()')
    elif vendor == 'sqlite':
        for name in reversed(SQLITE_TRIGGERS): schema_editor.execute(f'DROP TRIGGER {name}')
    else:
        raise RuntimeError('Unreviewed session database backend.')


class Migration(migrations.Migration):
    atomic = True
    dependencies = [('accounts','0002_auththrottlebucket_devicesession_user_session_epoch_and_more')]
    operations = [migrations.RunPython(install,uninstall)]
