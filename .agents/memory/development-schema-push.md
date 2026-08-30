---
name: Development schema push
description: Safe handling of legacy Drizzle schema conflicts in non-interactive Replit environments.
---

When a development-only schema addition meets an existing Drizzle naming conflict, do not use a force push by default. Apply the smallest additive change after reviewing the intended SQL, and keep production schema changes behind the approved Publish flow.

**Why:** The non-interactive runner cannot answer Drizzle's rename/conflict prompt, while force mode can make unrelated schema changes or choose an unsafe rename.

**How to apply:** Verify the database is reachable, inspect the generated contract/schema, apply only the reviewed development DDL, and document the operator-gated production path. This remains the safe fallback for new append-only finance tables.