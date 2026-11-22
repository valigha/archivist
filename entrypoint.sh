#!/bin/sh
set -eu

PUID="${PUID:-1000}"
PGID="${PGID:-1000}"
UMASK="${UMASK:-002}"

umask "$UMASK"
mkdir -p /app/config /app/library /app/log

if [ "$(id -u)" = "0" ]; then
  if ! getent group "$PGID" >/dev/null 2>&1; then
    addgroup -g "$PGID" archivist 2>/dev/null || addgroup -g "$PGID" -S archivist
  fi
  GROUP_NAME="$(getent group "$PGID" | cut -d: -f1)"
  if ! getent passwd "$PUID" >/dev/null 2>&1; then
    adduser -D -H -u "$PUID" -G "$GROUP_NAME" archivist 2>/dev/null || true
  fi
  # Config and log are small: fix them right away.
  chown -R "$PUID:$PGID" /app/config /app/log || true
  # The library can hold tens of thousands of files and a recursive chown over it can take
  # minutes, during which the page would not load. Fix the top folder now and the rest in the
  # background, and skip it when the library already belongs to the right user.
  LIB_OWNER="$(stat -c '%u:%g' /app/library 2>/dev/null || echo none)"
  if [ "$LIB_OWNER" != "$PUID:$PGID" ]; then
    chown "$PUID:$PGID" /app/library || true
    (chown -R "$PUID:$PGID" /app/library >/dev/null 2>&1 || true) &
  fi
  exec su-exec "$PUID:$PGID" node /app/gateway/server.mjs
fi

exec node /app/gateway/server.mjs
