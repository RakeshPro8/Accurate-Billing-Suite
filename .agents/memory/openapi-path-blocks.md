---
name: OpenAPI path blocks
description: Prevent sibling endpoint methods from being nested under the wrong path during contract edits.
---

OpenAPI path entries must be fully closed before adding a sibling path entry; YAML indentation determines which operation belongs to which URL, and Orval follows that structure exactly.

**Why:** A new path inserted between operations in an existing path can silently move the later operation to the new URL while code generation still succeeds.

**How to apply:** After editing `lib/api-spec/openapi.yaml`, inspect generated operation URLs for both the new endpoint and nearby existing operations before typechecking or using the client.