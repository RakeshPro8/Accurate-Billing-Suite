# Mobilinq release and recovery runbook

## Release gates

1. Review the OpenAPI contract and run `pnpm --filter @workspace/api-spec run codegen`.
2. Run `pnpm run typecheck`, `pnpm --filter @workspace/api-server run build`, the web/mobile builds, and the billing-app receipt print matrix. The release check installs Chromium, Firefox, and WebKit with Playwright's compatible host dependencies before running that matrix; a browser failure blocks promotion.
3. Confirm `SESSION_SECRET`, `DATABASE_URL`, and (when email is enabled) the SMTP settings are present. Never put any of these values in a backup, log, mobile bundle, or support ticket.
4. Take and inspect an admin redacted backup from Settings. It is an operational export, not a database restore.
5. Review the backup and restore plan with an operator before applying a production schema or deployment change.

Receipt print diagnostics from the release matrix are written to
`artifacts/billing-app/test-results/print-preview` (failed traces) and
`artifacts/billing-app/playwright-report` (HTML report). The release check
clears those paths before each run. If the browser matrix fails, it copies both
into a run-specific `release-evidence/<run-id>/` directory, writes a
`README.md` manifest with links to the report and traces, and creates a
matching `.tar.gz` bundle. The evidence is retained for at least 14 days by
default; set `RELEASE_EVIDENCE_RETENTION_DAYS` to the release environment's
approved retention period.

The release output prints the retained directory and archive paths. When the
validation provider exposes a stable artifact URL, set `RELEASE_EVIDENCE_URL`
to its artifact base URL; the output will include a direct run-specific link.
Configure the provider to retain `release-evidence/` (or the directory named
by `RELEASE_EVIDENCE_DIR`) and to publish the generated archive. A successful
run removes the evidence directory and the raw Playwright report/traces, so a
green release cannot expose stale evidence from an earlier failure.

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

Proxy `/api` to the API process and serve the web `dist/public` directory at the same origin. Preserve `X-Forwarded-Proto`, terminate TLS at the proxy, and expose `/api/healthz` for monitoring. The desktop path is the installable PWA: install it from the HTTPS origin, keep the endpoint same-origin, and use the browser's system-printer dialog or an approved network printer. For an approved company-server build, set `VITE_API_ORIGIN` to the exact HTTPS origin that serves the web app before `pnpm --filter @workspace/billing-app run build`; the browser rejects cross-origin, credential-bearing, path-based, or non-HTTPS production values and falls back to the current origin. Never add credentials to this setting. Update the PWA by publishing a new version so the service-worker version changes; users should close and reopen it after the service-worker update notice. Admins can confirm the API origin, app version, service-worker version, and last offline sync under Settings → Desktop / PWA diagnostics. Use Print from a sale receipt or repair ticket and select the OS-installed thermal printer in the browser dialog; direct USB/network-printer access is not required.

## Backup and recovery

The Settings backup is versioned and redacted. It includes operational catalog, customer, transaction, repair metadata, stores, business/tax settings, and privacy-safe audit metadata. It excludes PINs/hashes, sessions, SMTP passwords, repair device passwords, photos, and other credentials.

Keep encrypted backups in operator-controlled storage with a documented retention period. Recovery is deliberately not a browser action: operators must review the export, take a fresh database snapshot, rehearse restoration against a non-production database, and approve any production import or schema operation. If a release fails, stop traffic, preserve logs, restore the last known-good application/database pair, verify `/api/healthz`, sign in, check store isolation and tax totals, then reopen traffic.

## Offline and client boundaries

Offline data is scoped to the employee and current store. The service worker caches only the app shell; authenticated API responses never enter a shared browser cache. Safe reads can use an IndexedDB snapshot. Sales, customer/repair creation, repair status changes, and validated repair photos may enter the outbox. Replay uses server session identity, server tax/discount/store/numbering authority, idempotent operation IDs, version checks, shared JPEG/PNG/WebP validation, and explicit completed/conflict/error states. Stock changes, deletes, reports, settings, email, notifications, and privileged administration remain online-only.

Repair photos are currently retained as validated, bounded data URLs for the self-contained deployment. For higher-volume installations, migrate the photo bytes to a private object-storage namespace keyed by store and repair, keep only an attachment identifier and metadata in PostgreSQL, issue short-lived authorized reads, and remove the legacy row bytes only after an integrity-checked migration and backup.