---
name: Mobilinq Branding
description: Branding decisions and logo placement for the Mobilinq app.
---

## Logo asset

The Mobilinq logo is stored at `artifacts/billing-app/public/logo.jpg` and is referenced as `/logo.jpg` in the app header and in `settings.logoUrl` for invoices/receipts.

**Why:** Public-folder assets are served at the artifact root. The billing artifact's `BASE_PATH` is `/`, so `/logo.jpg` resolves correctly in both dev and production static serving.

**How to apply:** If the artifact base path ever changes, update all hardcoded `/logo.jpg` references to include the base path, or switch to a base64-encoded logo in `settings.logoUrl` to keep it environment-independent.

## App name

The app is branded as **Mobilinq**. This name is reflected in:
- `artifact.toml` title
- `index.html` `<title>` and meta tags
- App header / sidebar in `AppLayout.tsx`
- Default business name in the settings schema (`businessName` default = "Mobilinq")
- Invoices, receipts, and repair tickets fallback business name

**Why:** A single source of truth for the brand name prevents the app header and printed documents from disagreeing.

**How to apply:** If the brand changes again, update all of the above locations, plus any fallback strings in `SaleDetail.tsx`, `RepairDetail.tsx`, and `ReceiptPrint.tsx`.
