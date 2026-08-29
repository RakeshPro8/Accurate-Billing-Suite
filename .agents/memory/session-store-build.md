---
name: Session Store Build Asset
description: connect-pg-simple needs its table.sql file beside the bundled API entry point.
---

## Rule

When the API uses `connect-pg-simple` with `createTableIfMissing`, production and development builds must copy a valid `table.sql` into the API `dist` directory.

**Why:** The bundled API runs from `dist`, and connect-pg-simple resolves its schema file relative to the running bundle. If the asset is omitted, login fails with an HTTP 500 and an ENOENT error.

**How to apply:** Keep the session table asset generation in the API build step, and verify a fresh build contains `dist/table.sql` before publishing or moving the app to a company server.