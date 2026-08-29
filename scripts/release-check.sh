#!/usr/bin/env bash
set -euo pipefail

required=(DATABASE_URL SESSION_SECRET)
for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required release variable: $name" >&2
    exit 1
  fi
done

pnpm --filter @workspace/api-spec run codegen
pnpm run typecheck
pnpm --filter @workspace/api-server run build
echo "Release checks passed. Production deployment still requires operator approval and a reviewed backup."