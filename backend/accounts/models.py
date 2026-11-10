from django.contrib.auth.models import AbstractUser
from django.db import models
from django.conf import settings
from django.db.models import F, Q
from datetime import timedelta
from uuid import uuid4
from .schema_expressions import BucketEventsShape
SESSION_REASONS = [(value, value) for value in ['logout','credentials_changed','role_changed','status_changed',
    'refresh_reuse','idle_expired','absolute_expired','security_cutover','operator_revoked']]


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = 'admin', 'Admin'
        STAFF = 'staff', 'Staff'

    role = models.CharField(
        max_length=10,
        choices=Role.choices,
        default=Role.STAFF,
    )

    session_epoch = models.PositiveBigIntegerField(default=1, db_default=1, editable=False)

    class Meta(AbstractUser.Meta):
        abstract = False
        constraints = [models.CheckConstraint(condition=Q(session_epoch__gte=1, session_epoch__lte=9223372036854775807), name='acct_session_epoch_pos')]

    def save(self, *args, **kwargs):
        requested_fields = kwargs.get('update_fields')
        explicit_password_change = (not self._state.adding and self._password is not None
            and (requested_fields is None or 'password' in requested_fields))
        # The epoch is trigger-owned; full ORM saves must not write the column.
        if not self._state.adding:
            fields = kwargs.get('update_fields')
            if fields and 'session_epoch' in fields:
                from django.core.exceptions import ValidationError
                raise ValidationError('Security epoch is database controlled.')
            if fields is None:
                kwargs['update_fields'] = [field.name for field in self._meta.concrete_fields
                    if not field.primary_key and field.name != 'session_epoch']
        super().save(*args, **kwargs)
        if explicit_password_change:
            from django.db import transaction
            import logging
            actor_id = self.pk
            transaction.on_commit(lambda: logging.getLogger('accounts.security').info('Explicit password change persisted',extra={'actor_id':actor_id}))

    def __str__(self):
        return f"{self.username} ({self.role})"


class DeviceSession(models.Model):
    REASONS = SESSION_REASONS
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='device_sessions', db_index=False)
    user_epoch = models.PositiveBigIntegerField(editable=False)
    created_at = models.DateTimeField(editable=False)
    last_activity_at = models.DateTimeField()
    absolute_expires_at = models.DateTimeField(editable=False)
    refresh_generation = models.PositiveBigIntegerField(default=0)
    refresh_jti_hash = models.CharField(max_length=64)
    revoked_at = models.DateTimeField(null=True, blank=True)
    revocation_reason = models.CharField(max_length=24, blank=True, default='', choices=REASONS)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=Q(user_epoch__gte=1, user_epoch__lte=9223372036854775807), name='ds_epoch_pos'),
            models.CheckConstraint(condition=Q(refresh_generation__gte=0, refresh_generation__lte=9223372036854775807), name='ds_gen_nonneg'),
            models.CheckConstraint(condition=Q(last_activity_at__gte=F('created_at'), last_activity_at__lt=F('absolute_expires_at')), name='ds_time_bounds'),
            models.CheckConstraint(condition=Q(absolute_expires_at=F('created_at') + timedelta(hours=8)), name='ds_abs_8h'),
            models.CheckConstraint(condition=Q(refresh_jti_hash__regex=r'\A[0-9a-f]{64}\Z'), name='ds_jti_hex'),
            models.CheckConstraint(condition=(Q(revoked_at__isnull=True, revocation_reason='') | Q(revoked_at__isnull=False, revocation_reason__in=[value for value,_ in SESSION_REASONS])), name='ds_revocation_pair'),
            models.CheckConstraint(condition=Q(revoked_at__isnull=True) | Q(revoked_at__gte=F('created_at')), name='ds_revoked_after_start'),
        ]
        indexes = [models.Index(fields=['user','-created_at'], name='ds_user_created'),
            models.Index(fields=['absolute_expires_at'], name='ds_abs_expiry'),
            models.Index(fields=['last_activity_at'], condition=Q(revoked_at__isnull=True), name='ds_active_idle')]


class AuthThrottleBucket(models.Model):
    scope = models.CharField(max_length=2, choices=[(value,value) for value in ['LA','LI','LR','RR']])
    key_version = models.PositiveSmallIntegerField()
    subject_digest = models.CharField(max_length=64)
    event_times = models.JSONField(default=list)
    updated_at = models.DateTimeField()

    class Meta:
        constraints = [
            models.CheckConstraint(condition=Q(scope__in=['LA','LI','LR','RR']), name='at_scope_valid'),
            models.CheckConstraint(condition=Q(key_version__gte=1, key_version__lte=32767), name='at_keyver_pos'),
            models.CheckConstraint(condition=Q(subject_digest__regex=r'\A[0-9a-f]{64}\Z'), name='at_digest_hex'),
            models.CheckConstraint(condition=BucketEventsShape(F('event_times')), name='at_events_shape'),
            models.UniqueConstraint(fields=['scope','key_version','subject_digest'], name='at_scope_key_unique'),
        ]
        indexes = [models.Index(fields=['updated_at'], name='at_cleanup_time')]
