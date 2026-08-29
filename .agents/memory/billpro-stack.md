---
name: BillPro Stack & Conventions
description: Key patterns for the BillPro billing app — hooks, mutations, API client, schema.
---

## Stack
- Frontend: React + Vite (`artifacts/billing-app`), wouter routing, shadcn/ui, TailwindCSS v4
- Backend: Express (`artifacts/api-server`), built with esbuild, port 8080
- DB: PostgreSQL + Drizzle ORM (`lib/db`), schema in `lib/db/src/schema/`
- API client: Orval-generated hooks in `@workspace/api-client-react` — codegen from OpenAPI spec at `lib/api-spec`
- Rebuild library project references with `pnpm run typecheck:libs` before app typechecking when generated client exports appear stale.

## Key Conventions
- Mutation pattern: `hook.mutate({ data: {...} })` — hooks return T directly (not wrapped)
- New DB tables: add file in `lib/db/src/schema/`, export from `index.ts`, then run `pnpm --filter @workspace/db run push`
- New API routes: create file in `artifacts/api-server/src/routes/`, register in `routes/index.ts`, restart workflow
- For new endpoints NOT in Orval spec: write custom hooks using `useQuery`/`useMutation` + fetch in `artifacts/billing-app/src/lib/`
- API server requires manual restart (build + start) — HMR does not apply to it

## Schema files
- `employees.ts` — id, name, email, pin (plaintext 4-8 digit), role, maxDiscountPct, active
- `customers.ts` — added isLoyaltyMember (boolean), loyaltyDiscountPct (numeric)
- `sales.ts` — added employeeId (integer), employeeName (text)
