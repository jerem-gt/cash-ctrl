#!/bin/sh
# Contrôles propres à cash-ctrl, après ceux du workflow commun (santé, front, docs).
# Usage : smoke-test.sh <url de base> <nom du conteneur>
set -eu
BASE_URL=$1

# Login avec le compte par défaut : bcrypt et SQLite
curl -fsS -o /dev/null -X POST -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"changeme"}' \
  "$BASE_URL/api/auth/login"
