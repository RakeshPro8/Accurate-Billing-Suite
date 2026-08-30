---
name: Expo monorepo resolution
description: Metro behavior for the pnpm workspace used by the Mobilinq native app
---

Expo SDK 54's default Metro configuration detects this pnpm workspace, watches the shared library, and resolves both the app and workspace node_modules paths. The shared API package can therefore remain a source-exported workspace package without custom resolver aliases.

**Why:** Explicit resolver overrides can conflict with Expo's automatic monorepo support; clean Android and iOS exports already prove the shared package resolves through the default configuration.

**How to apply:** Verify the default config and run native exports before adding watch-folder, symlink, or package-alias overrides to the mobile Metro config.