---
name: Repair Ticketing Implementation
description: Decisions and constraints from adding the Repair Ticketing & Work Orders module to BillPro.
---

## Decisions

### Repair photos stored as base64 in PostgreSQL
Repair intake photos are stored as `data_url` text in the `repair_photos` table.

**Why:** Replit Object Storage requires Replit Auth for protected uploads, and this feature needed to stay self-contained within the existing employee/PIN auth model. Base64 keeps photos inside the app, requires no additional integration, and is acceptable for small device-damage photos.

**How to apply:** When adding more photo-heavy features, revisit this trade-off. For customer-facing galleries or high-volume images, migrate to Object Storage and accept the Replit Auth requirement.

### OpenAPI-first workflow for repair endpoints
The repair endpoints, schemas, and generated React hooks were built by updating the OpenAPI spec first, then running codegen.

**Why:** This is the established BillPro workflow. Keeping the spec as the source of truth ensures the frontend hooks, Zod validators, and route types stay in sync. Any hand-written types will diverge the next time codegen runs.

**How to apply:** Add new domain endpoints to `lib/api-spec/openapi.yaml` first, run `pnpm --filter @workspace/api-spec run codegen`, then implement the route and UI.

## Constraints

### Express route handlers must return the response object consistently
The project uses TypeScript with strict checks. Express handlers that return `res.status(...)` in catch blocks but only call `res.json(...)` in try blocks fail type-check with `TS7030: Not all code paths return a value`.

**Why:** TypeScript infers the function's return type from the first explicit `return`. Once a return exists in one branch, every branch must return a value of a compatible type.

**How to apply:** Always write `return res.status(...)` and `return res.json(...)` in Express routes, or remove all `return` keywords and declare `void` return types. Do not mix the two styles in the same handler.

### Radix Select does not allow empty-string item values
`<SelectItem value="">` causes a runtime error: "A Select.Item must have a value prop that is not an empty string."

**Why:** Radix uses an empty value internally to represent the placeholder state.

**How to apply:** Use a sentinel value such as `"none"` for optional/unassigned choices, then convert `"none"` back to `undefined` or `null` in the change handler.
