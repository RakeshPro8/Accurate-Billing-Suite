# Mobilinq release and recovery runbook

## Release gates

1. Review the OpenAPI contract and run `pnpm --filter @workspace/api-spec run codegen`.
2. Run `pnpm run typecheck`, `pnpm --filter @workspace/api-server run build`, and the web/mobile builds.
3. Confirm `SESSION_SECRET`, `DATABASE_URL`, and (when email is enabled) the SMTP settings are present. Never put any of these values in a backup, log, mobile bundle, or support ticket.
4. Take and inspect an admin redacted backup from Settings. It is an operational export, not a database restore.
5. Review the backup and restore plan with an operator before applying a production schema or deployment change.

## Replit

The API and web artifacts are managed by their registered workflows. Replit Publish is the approved production path: it builds the API with `NODE_ENV=production`, serves it on the configured artifact port, and probes `/api/healthz`. Do not apply development schema changes directly to production. Use the Publish workflow's reviewed schema step and retain the pre-release backup.

Health checks:

```sh
curl -fsS "$APP_ORIGIN/api/healthz"
pnpm run typecheck
```

If a workflow fails, stop promotion, inspect workflow logs, and restore the prior checkpoint or deployment. Do not repeatedly restart a failing production service without identifying whether the failure is configuration, schema, or code.

## Company server package

Build from a clean checkout with Node 24 and pnpm:

```sh
pnpm install --frozen-lockfile
pnpm --filter @workspace/api-spec run codegen
pnpm run typecheck
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/billing-app run build
```

Run the API bundle behind an HTTPS reverse proxy with:

- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: high-entropy private session secret
- `APP_ORIGIN` or `CORS_ORIGIN`: the exact HTTPS web origin(s)
- `SESSION_COOKIE_SECURE=true` and `SESSION_COOKIE_SAMESITE=lax`
- `PORT=8080` (or the operator-selected internal port)

Proxy `/api` to the API process and serve the web `dist/public` directory at the same origin. Preserve `X-Forwarded-Proto`, terminate TLS at the proxy, and expose `/api/healthz` for monitoring. The desktop path is the installable PWA: install it from the HTTPS origin, keep the endpoint same-origin where possible, and use the browser's system-printer dialog or an approved network printer. Update the PWA by publishing a new version; users should close and reopen it after the service-worker update notice.

## Backup and recovery

The Settings backup is versioned and redacted. It includes operational catalog, customer, transaction, repair metadata, stores, business/tax settings, and privacy-safe audit metadata. It excludes PINs/hashes, sessions, SMTP passwords, repair device passwords, photos, and other credentials.

Keep encrypted backups in operator-controlled storage with a documented retention period. Recovery is deliberately not a browser action: operators must review the export, take a fresh database snapshot, rehearse restoration against a non-production database, and approve any production import or schema operation. If a release fails, stop traffic, preserve logs, restore the last known-good application/database pair, verify `/api/healthz`, sign in, check store isolation and tax totals, then reopen traffic.

## Offline and client boundaries

Offline data is scoped to the employee and current store. The service worker caches only the app shell; authenticated API responses never enter a shared browser cache. Safe reads can use an IndexedDB snapshot. Only sales, customer/repair creation, and repair status changes may enter the outbox. Replay uses server session identity, server tax/discount/store/numbering authority, idempotent operation IDs, version checks, and explicit completed/conflict/error states. Stock changes, deletes, reports, settings, email, notifications, and privileged administration remain online-only.