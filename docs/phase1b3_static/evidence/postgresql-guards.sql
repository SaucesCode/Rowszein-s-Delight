-- REVIEW ONLY. NOT EXECUTED. Requires the separately approved schema/migration checkpoint.

CREATE FUNCTION accounts_security_epoch_direct() RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN RAISE EXCEPTION 'security epoch is database controlled'; END; $$;


CREATE FUNCTION accounts_security_epoch_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
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


CREATE FUNCTION accounts_security_epoch_revoke() RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
 IF NEW.session_epoch <> OLD.session_epoch THEN
  UPDATE accounts_devicesession SET revoked_at=clock_timestamp(), revocation_reason=
   CASE WHEN NEW.password IS DISTINCT FROM OLD.password THEN 'credentials_changed'
        WHEN NEW.role IS DISTINCT FROM OLD.role THEN 'role_changed' ELSE 'status_changed' END
   WHERE user_id=NEW.id AND revoked_at IS NULL;
 END IF;
 RETURN NEW;
END; $$;


CREATE FUNCTION accounts_device_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
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


CREATE FUNCTION accounts_throttle_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
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

CREATE TRIGGER accounts_security_epoch_direct BEFORE UPDATE OF session_epoch ON public.accounts_user FOR EACH STATEMENT EXECUTE FUNCTION public.accounts_security_epoch_direct();
CREATE TRIGGER accounts_security_epoch_guard BEFORE INSERT OR UPDATE ON public.accounts_user FOR EACH ROW EXECUTE FUNCTION public.accounts_security_epoch_guard();
CREATE TRIGGER accounts_security_epoch_revoke AFTER UPDATE ON public.accounts_user FOR EACH ROW EXECUTE FUNCTION public.accounts_security_epoch_revoke();
CREATE TRIGGER accounts_device_guard BEFORE INSERT OR UPDATE ON public.accounts_devicesession FOR EACH ROW EXECUTE FUNCTION public.accounts_device_guard();
CREATE TRIGGER accounts_throttle_guard BEFORE INSERT OR UPDATE ON public.accounts_auththrottlebucket FOR EACH ROW EXECUTE FUNCTION public.accounts_throttle_guard();
