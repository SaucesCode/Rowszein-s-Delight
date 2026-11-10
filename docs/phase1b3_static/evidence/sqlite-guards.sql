-- REVIEW ONLY. NOT EXECUTED. SQLite also requires the connection authorizer.
CREATE TRIGGER accounts_security_epoch_insert BEFORE INSERT ON accounts_user
WHEN NEW.session_epoch <> 1 BEGIN SELECT RAISE(ABORT,'initial epoch must be one'); END;
CREATE TRIGGER accounts_security_epoch_guard BEFORE UPDATE ON accounts_user BEGIN
 SELECT CASE WHEN rs_guarded_connection() <> 1 THEN RAISE(ABORT,'guarded connection required') END;
 SELECT CASE WHEN (NEW.password IS NOT OLD.password OR NEW.role IS NOT OLD.role OR NEW.is_active IS NOT OLD.is_active
  OR NEW.is_staff IS NOT OLD.is_staff OR NEW.is_superuser IS NOT OLD.is_superuser)
  AND OLD.session_epoch >= 9223372036854775807 THEN RAISE(ABORT,'security epoch exhausted') END;
END;
CREATE TRIGGER accounts_security_epoch_bump AFTER UPDATE OF password,role,is_active,is_staff,is_superuser ON accounts_user
WHEN NEW.password IS NOT OLD.password OR NEW.role IS NOT OLD.role OR NEW.is_active IS NOT OLD.is_active
 OR NEW.is_staff IS NOT OLD.is_staff OR NEW.is_superuser IS NOT OLD.is_superuser BEGIN
 UPDATE accounts_devicesession SET revoked_at=strftime('%Y-%m-%d %H:%M:%f','now') || '000',
  revocation_reason=CASE WHEN NEW.password IS NOT OLD.password THEN 'credentials_changed'
   WHEN NEW.role IS NOT OLD.role THEN 'role_changed' ELSE 'status_changed' END WHERE user_id=NEW.id AND revoked_at IS NULL;
 UPDATE accounts_user SET session_epoch=OLD.session_epoch+1 WHERE id=NEW.id;
END;
CREATE TRIGGER accounts_device_insert BEFORE INSERT ON accounts_devicesession BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM accounts_user WHERE id=NEW.user_id AND is_active=1
  AND role IN ('admin','staff') AND session_epoch=NEW.user_epoch) OR NEW.refresh_generation<>0 OR NEW.revoked_at IS NOT NULL
  OR julianday(NEW.created_at)>julianday('now') THEN RAISE(ABORT,'invalid initial device state') END;
END;
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
END;
CREATE TRIGGER accounts_throttle_insert BEFORE INSERT ON accounts_auththrottlebucket BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM json_each(NEW.event_times) e WHERE e.type<>'integer' OR e.value<0
  OR e.value>CAST(strftime('%s',substr(NEW.updated_at,1,19)) AS INTEGER)*1000000+
   CASE WHEN substr(NEW.updated_at,20,1)='.' THEN CAST(substr(substr(NEW.updated_at,21)||'000000',1,6) AS INTEGER) ELSE 0 END
  OR (CAST(e.key AS INTEGER)>0 AND e.value<json_extract(NEW.event_times,'$[' || (CAST(e.key AS INTEGER)-1) || ']')))
  THEN RAISE(ABORT,'invalid throttle events') END;
END;
CREATE TRIGGER accounts_throttle_update BEFORE UPDATE ON accounts_auththrottlebucket BEGIN
 SELECT CASE WHEN NEW.id IS NOT OLD.id OR NEW.scope IS NOT OLD.scope OR NEW.key_version IS NOT OLD.key_version
  OR NEW.subject_digest IS NOT OLD.subject_digest OR NEW.updated_at<OLD.updated_at THEN RAISE(ABORT,'invalid throttle identity or clock') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM json_each(NEW.event_times) e WHERE e.type<>'integer' OR e.value<0
  OR e.value>CAST(strftime('%s',substr(NEW.updated_at,1,19)) AS INTEGER)*1000000+
   CASE WHEN substr(NEW.updated_at,20,1)='.' THEN CAST(substr(substr(NEW.updated_at,21)||'000000',1,6) AS INTEGER) ELSE 0 END
  OR (CAST(e.key AS INTEGER)>0 AND e.value<json_extract(NEW.event_times,'$[' || (CAST(e.key AS INTEGER)-1) || ']')))
  THEN RAISE(ABORT,'invalid throttle events') END;
END;
