#!/usr/bin/env bash
set -euo pipefail

# This directory belongs only to the teaching deployment, not to the editor checkout.
if [ "${CODESPACES:-}" != "true" ]; then
  echo 'This command must run inside GitHub Codespaces.' >&2
  exit 1
fi
mode="${1:-start}"
version="${2:-}"
root=/workspaces/lab19-cloud
mkdir -p "$root"
cd "$root"
umask 077

if [ "$mode" = deploy ]; then
  if ! [[ "$version" =~ ^[0-9a-f]{40}$ ]]; then
    echo 'Expected a complete Git commit SHA.' >&2
    exit 1
  fi
  # Download exactly the configuration that was checked by this Actions run.
  curl --fail --silent --show-error --retry 3 \
    "https://raw.githubusercontent.com/Greaf07/veb-lab19-cicd/$version/docker-compose.yml" -o compose.yml
  cat > cloud.yml <<EOF
services:
  api:
    image: ghcr.io/greaf07/veb-lab19-cicd:$version
  db:
    volumes:
      - /workspaces/lab19-cloud/postgres:/var/lib/postgresql/data
EOF
  if [ ! -f .env ]; then
    node <<'NODE'
const { randomBytes } = require('node:crypto');
const { writeFileSync } = require('node:fs');
const values = { APP_PORT: '3006', POSTGRES_USER: 'lab19', POSTGRES_DB: 'lab19_auth' };
for (const key of ['POSTGRES_PASSWORD', 'JWT_SECRET', 'DEMO_ADMIN_PASSWORD', 'DEMO_USER_PASSWORD']) {
  values[key] = randomBytes(32).toString('hex');
}
writeFileSync('.env', Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n') + '\n', { flag: 'wx', mode: 0o600 });
NODE
  fi
elif [ "$mode" != start ]; then
  echo 'Mode must be deploy or start.' >&2
  exit 1
fi

if [ ! -f compose.yml ] || [ ! -f cloud.yml ] || [ ! -f .env ]; then
  echo 'No deployed application found. Run the deployment workflow first.' >&2
  exit 1
fi

for attempt in $(seq 1 30); do
  if docker info >/dev/null 2>&1; then break; fi
  sleep 2
done
docker info >/dev/null
compose=(docker compose -p veb-lab19-cloud --env-file .env -f compose.yml -f cloud.yml)
if [ "$mode" = deploy ]; then
  "${compose[@]}" pull api db
fi
"${compose[@]}" up -d --no-build --wait --wait-timeout 180
curl --fail --silent --show-error http://127.0.0.1:3006/health
echo
if [ "$mode" = deploy ]; then
  printf '%s\n' "$version" > deployed-version.txt
fi
