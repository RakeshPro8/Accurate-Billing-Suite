---
name: Cross-browser print validation
description: Cross-engine browser print checks and the host dependency caveat for WebKit.
---

Keep Chromium, Firefox, and WebKit/Safari in the receipt print release matrix even when one local runner cannot launch WebKit.

**Why:** Playwright's bundled WebKit validates and loads Debian-style shared-library names. A Nix environment can have semantically equivalent libraries without exposing those exact ABI aliases, so local WebKit failures can be host compatibility failures rather than test failures.

**How to apply:** Do not silently skip or weaken the WebKit project. Install the browser host dependencies in a compatible CI image, document the local limitation, and use the available engines for local signal. Chromium can also need explicit Nix runtime libraries such as GLib, NSS/NSPR, Mesa GBM, and libxkbcommon before its bundled binary launches.