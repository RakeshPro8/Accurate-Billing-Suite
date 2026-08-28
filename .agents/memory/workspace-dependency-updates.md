---
name: Workspace dependency updates
description: Package-management constraint for this pnpm monorepo
---

For dependency maintenance in this monorepo, package additions must remain in their owning workspace package; a generic package-install helper may reject the operation because it would add every package to the workspace root.

**Why:** The project uses multiple package manifests and a shared pnpm lockfile, so accidentally adding dependencies to the root changes dependency ownership and can create misleading installs.

**How to apply:** Update the owning manifest and regenerate the lockfile with a workspace-aware pnpm install/update. Confirm the root manifest did not gain application dependencies.