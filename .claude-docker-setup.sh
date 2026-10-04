#!/usr/bin/env bash
#
# Image-build setup for `yarn test:e2e:api`: PostgreSQL 18 and Redis, plus an
# `e2e-services` command that starts both again in a later session.
#
#   bash .claude-docker-setup.sh
#   e2e-services
#   DATABASE_URL=postgresql://logigator:logigator@localhost:5432/logigator \
#   REDIS_URL=redis://localhost:6379 yarn test:e2e:api

set -euo pipefail

PG_MAJOR=18
PG_PORT=5432
BASE=/var/lib/logigator-e2e
PG_BIN=/usr/lib/postgresql/${PG_MAJOR}/bin

# initdb and the server refuse to run as root.
pg() { su -s /bin/bash postgres -c "$1"; }

if [ ! -x "${PG_BIN}/postgres" ]; then
  export DEBIAN_FRONTEND=noninteractive
  # Stop the postinst from starting the cluster it creates.
  printf '#!/bin/sh\nexit 101\n' >/usr/sbin/policy-rc.d
  chmod +x /usr/sbin/policy-rc.d

  apt-get update
  apt-get install -y --no-install-recommends ca-certificates curl gnupg locales

  # bookworm's own repository carries 15; the compose stack runs 18.
  install -d /usr/share/postgresql-common/pgdg
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc
  echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" \
    >/etc/apt/sources.list.d/pgdg.list
  apt-get update
  apt-get install -y --no-install-recommends \
    "postgresql-${PG_MAJOR}" redis-server redis-tools

  rm -rf /var/lib/apt/lists/* /usr/sbin/policy-rc.d

  # postgres:18-alpine initdb's under en_US.utf8, and collation is fixed at initdb.
  sed -i 's/^# *en_US.UTF-8 UTF-8/en_US.UTF-8 UTF-8/' /etc/locale.gen
  locale-gen

  # The cluster postgresql-common leaves for an init system to run, on this port.
  if [ -d "/etc/postgresql/${PG_MAJOR}/main" ]; then
    pg_dropcluster --stop "${PG_MAJOR}" main
  fi
fi

if [ ! -s "${BASE}/pgdata/PG_VERSION" ]; then
  install -d -m 755 -o postgres -g postgres "${BASE}"
  install -d -m 700 -o postgres -g postgres "${BASE}/pgdata"
  install -m 644 -o postgres -g postgres /dev/null "${BASE}/postgres.log"

  # Superuser `logigator` is the one DATABASE_URL names, and the role the harness
  # issues CREATE/DROP DATABASE as. Local trust, host scram.
  pwfile=$(mktemp)
  printf 'logigator' >"${pwfile}"
  chown postgres "${pwfile}"
  pg "${PG_BIN}/initdb -D '${BASE}/pgdata' -U logigator --pwfile='${pwfile}' \
    --auth-local=trust --auth-host=scram-sha-256 -E UTF8 --locale=en_US.utf8"
  rm -f "${pwfile}"
fi

cat >/usr/local/bin/e2e-services <<'EOF'
#!/bin/sh
set -e
BASE=/var/lib/logigator-e2e

# A killed postmaster leaves files that block the next start, and `pg_ctl status`
# reads the zombie it also leaves as a running server, so ask the port instead.
pg_isready -h 127.0.0.1 -p 5432 -q || {
  rm -f "${BASE}/pgdata/postmaster.pid" "${BASE}/.s.PGSQL.5432"*
  su -s /bin/bash postgres -c "/usr/lib/postgresql/18/bin/pg_ctl -D '${BASE}/pgdata' \
    -l '${BASE}/postgres.log' -w -o \"-c listen_addresses=localhost -c port=5432 \
    -c unix_socket_directories=${BASE} -c fsync=off -c synchronous_commit=off \
    -c full_page_writes=off\" start"
}
redis-cli -h 127.0.0.1 -p 6379 ping >/dev/null 2>&1 ||
  redis-server --bind 127.0.0.1 --port 6379 --save '' --appendonly no \
    --dir "${BASE}" --logfile "${BASE}/redis.log" --pidfile "${BASE}/redis.pid" \
    --daemonize yes
EOF
chmod +x /usr/local/bin/e2e-services

e2e-services

# initdb's own databases are postgres, template0 and template1.
if ! pg "${PG_BIN}/psql -h '${BASE}' -p ${PG_PORT} -U logigator -d postgres -tAc \
  \"select 1 from pg_database where datname = 'logigator'\"" | grep -q 1; then
  pg "${PG_BIN}/createdb -h '${BASE}' -p ${PG_PORT} -U logigator -O logigator logigator"
fi

# Nothing keeps running past the build: it would be killed rather than stopped.
pg "${PG_BIN}/pg_ctl -D '${BASE}/pgdata' -m fast -w stop"
redis-cli -h 127.0.0.1 -p 6379 shutdown nosave
