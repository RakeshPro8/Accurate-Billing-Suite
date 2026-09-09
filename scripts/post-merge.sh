#!/bin/bash
set -euo pipefail
pnpm install --frozen-lockfile
pnpm --filter @workspace/scripts run db:sync
pnpm --filter @workspace/scripts run db:verify
