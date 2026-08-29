---
name: App Branding & Themes
description: Settings-driven app name, logo, and complete visual themes in BillPro/Mobilinq.
---

## Rule

App branding (name, logo, theme) lives in the `settings` table and is configurable from the Settings page. Theme presets are complete visual identities, not accent-color swaps.

**Why:** The business name on invoices and receipts should be independent from the app name shown in the browser tab and sidebar. Different installations or locations should be able to look clearly distinct without changing functionality or rebuilding the app.

**How to apply:**

1. Store `appName`, `businessName`, and `theme` in the `settings` table.
2. Use `appName` and `logoUrl` in `AppLayout.tsx` for the sidebar, mobile header, and `document.title`.
3. Continue using `businessName` and `logoUrl` on printed invoices and receipts.
4. Apply the theme by setting `data-theme` on `document.documentElement` in a layout effect driven by `useGetSettings()`.
5. Define each theme as a full visual system under `[data-theme="..."]` in `index.css`: light/dark surfaces, navigation treatment, typography, radii, shadows, borders, charts, controls, and optional background texture. The default `:root` is the `terminal` theme; higher-specificity attribute selectors override it.
6. Provide a visual theme picker in Settings with miniature workspace previews. It calls `setValue("theme", ...)`; the change takes effect after the settings mutation is saved and React Query invalidates the settings cache.
