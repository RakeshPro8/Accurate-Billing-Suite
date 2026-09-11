---
name: Expo Metro security backport
description: Compatibility constraint for removing Metro's vulnerable image-size dependency on Expo SDK 54
---

Keep Expo SDK 54 on Metro 0.83.3 and retain the upstream image parser backport that removes the external `image-size` dependency. Do not force Metro 0.83.8 as a dependency override while the app remains on this Expo SDK.

**Why:** Metro 0.83.8 removes `image-size`, but its file-map event shape is incompatible with Expo SDK 54's CLI and crashes during multi-platform production bundling. Backporting only the upstream image parsing change keeps the security fix without changing watcher APIs.

**How to apply:** During dependency maintenance, verify both iOS and Android bundles complete. Remove the backport only after upgrading Expo and confirming the newer supported Metro version passes the full mobile production build.