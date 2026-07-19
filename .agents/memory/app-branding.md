---
name: App Branding & Themes
description: Settings-driven app name, logo, and color themes in BillPro/Mobilinq.
---

## Rule

App branding (name, logo, theme) lives in the `settings` table and is configurable from the Settings page.

**Why:** The business name on invoices and receipts should be independent from the app name shown in the browser tab and sidebar. The theme should be selectable without rebuilding the app.

**How to apply:**

1. Store `appName`, `businessName`, and `theme` in the `settings` table.
2. Use `appName` and `logoUrl` in `AppLayout.tsx` for the sidebar, mobile header, and `document.title`.
3. Continue using `businessName` and `logoUrl` on printed invoices and receipts.
4. Apply the theme by setting `data-theme` on `document.documentElement` in a layout effect driven by `useGetSettings()`.
5. Define each theme as a full set of CSS custom properties under `[data-theme="..."]` in `index.css`. The default `:root` is the `terminal` theme; higher-specificity attribute selectors override it.
6. Provide a visual theme picker in Settings that calls `setValue("theme", ...)`. The change takes effect after the settings mutation is saved and React Query invalidates the settings cache.
