---
name: Store scope bootstrap
description: Why store-scoped requests can fail in a newly initialized Mobilinq database and the safe recovery principle.
---

Store-scoped API routes should continue to reject requests without an active store. When a newly initialized development database has no store rows, the application needs an explicit, safe initial-store onboarding path and must select that store before loading scoped data.

**Why:** Relaxing the scope requirement would allow ambiguous cross-location reads and writes. The observed failure was a valid 409 surfaced before the UI had a concrete location to select.

**How to apply:** When provisioning or resetting a local environment, verify at least one active store exists. Keep the UI recovery path visible and retry store-scoped queries after the current-store selection succeeds.