# BillPro

All-in-one billing and repair shop operations app: sales, quotations, customers, inventory, employees, reports, and work-order/repair ticketing.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for API contracts and generated hooks
- `lib/db/src/schema/` — Drizzle schemas, one file per domain
- `lib/db/src/schema/repairs.ts` — repair tickets, intake photos, and repair parts
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/billing-app/src/pages/` — React page components
- `artifacts/billing-app/src/components/ui/` — shadcn/ui components themed for BillPro
- `artifacts/billing-app/src/index.css` — dark PyQt terminal theme CSS variables

## Architecture decisions

- OpenAPI-first: update the spec first, then run codegen to keep frontend hooks, Zod validators, and backend types in sync.
- Repair intake photos are stored as base64 `data_url` in PostgreSQL to keep the feature self-contained. Object Storage would require Replit Auth for protected uploads, which conflicts with the existing PIN-based employee auth model.
- Express routes consistently `return` the response object so TypeScript strict checks pass without declaring explicit return types.
- Optional Radix Select choices use a `"none"` sentinel value because empty string is reserved for the placeholder state.
- Employee auth is PIN-based and kept in localStorage via `EmployeeContext`; no JWT or OAuth is used.

## Product

- Point-of-sale sales with invoicing, payments, and printable receipts
- Customer database with order history and total spent tracking
- Product and service catalog with stock tracking
- Quotation workflow with status lifecycle and conversion to sales
- Employee management with PIN sign-in and discount limits
- Repair/work-order tracking: intake, diagnostic, parts, QA, pickup, and customer notifications
- Dashboard reports for revenue, sales, and top products
- Settings for business profile, tax rates, SMTP, and receipt branding

## User preferences

_None recorded yet._

## Gotchas

- After changing `lib/api-spec/openapi.yaml`, run `pnpm --filter @workspace/api-spec run codegen` and `pnpm --filter @workspace/db run push` before testing.
- Express routes must `return` the `res` object in every branch, or `tsc` will fail with `TS7030`.
- Do not use `<SelectItem value="">`; Radix rejects empty item values.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See `.agents/memory/repair-ticketing.md` for repair-module implementation decisions
