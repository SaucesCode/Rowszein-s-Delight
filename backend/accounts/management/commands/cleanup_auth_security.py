"""Bounded operator job. NOT executed at the static checkpoint."""
from datetime import timedelta
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from accounts.models import DeviceSession, AuthThrottleBucket
from accounts.session_database import database_time, lock_users, set_transaction_bounds


class Command(BaseCommand):
    help = 'Delete retained security records only; default reports counts without deleting.'

    def add_arguments(self,parser):
        parser.add_argument('--execute',action='store_true')
        parser.add_argument('--batch-size',type=int,default=200)

    def handle(self,*args,**options):
        size = options['batch_size']
        if not 1 <= size <= 1000: raise CommandError('Batch size must be 1..1000.')
        with transaction.atomic():
            set_transaction_bounds()
            now = database_time()
            sessions = DeviceSession.objects.filter(absolute_expires_at__lt=now-timedelta(days=30))
            buckets = AuthThrottleBucket.objects.filter(updated_at__lt=now-timedelta(hours=24))
            if not options['execute']:
                self.stdout.write(f'Eligible sessions={sessions.count()} buckets={buckets.count()}; no deletion.')
                return
            candidates = list(sessions.order_by('user_id','pk').values_list('pk','user_id')[:size])
            lock_users([uid for _,uid in candidates])
            selected = DeviceSession.objects.filter(pk__in=[sid for sid,_ in candidates]).order_by('pk')
            selected = selected.select_for_update(skip_locked=connection.vendor=='postgresql')
            ids = list(selected.values_list('pk',flat=True))
            DeviceSession.objects.filter(pk__in=ids).delete()
            stale = buckets.order_by('pk').select_for_update(skip_locked=connection.vendor=='postgresql')
            keys = list(stale.values_list('pk',flat=True)[:size])
            # A refresh/append can never resurrect a selected row after its lock.
            AuthThrottleBucket.objects.filter(pk__in=keys,updated_at__lt=now-timedelta(hours=24)).delete()
            self.stdout.write(f'Deleted sessions={len(ids)} buckets={len(keys)}; no business rows changed.')
