#!/bin/sh
# Restores a backup made by backup-db.cmd into an EMPTY database. Runs inside a
# postgres container; used by check-backup.cmd and restore-db.cmd.
#
#   RESTORE_TARGET=<connection string> sh /scripts/pg-restore-app.sh /backup/<file>.dump
set -eu
dump="$1"
target="${RESTORE_TARGET:?RESTORE_TARGET is not set}"

existing=$(psql --no-psqlrc --tuples-only --no-align --dbname="$target" \
  --command="SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")
if [ "$existing" != "0" ]; then
  echo "Refusing to restore: that database already has $existing tables. Restore only into a new, empty database."
  exit 3
fi

# Every PostgreSQL database already has the public schema, so skip creating it.
pg_restore --list "$dump" | grep -v -E ' SCHEMA - public | COMMENT - SCHEMA public ' > /tmp/restore.list
# One transaction: if anything fails, the target is left exactly as it was.
pg_restore --no-owner --no-privileges --exit-on-error --single-transaction \
  --use-list=/tmp/restore.list --dbname="$target" "$dump"
