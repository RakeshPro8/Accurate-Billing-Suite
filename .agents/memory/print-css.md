---
name: Print CSS in BillPro/Mobilinq
description: How to keep printed invoices and tickets free of screen UI in a React + Tailwind app.
---

## Rule

Printed pages must show **only** the document, not the app chrome (sidebar, header, buttons, forms) or surrounding screen content.

**Why:** Repair tickets, invoices, and receipts are rendered inside the normal React layout. Without explicit print rules, the browser prints the whole viewport — navigation, cards, dialogs, and the document all at once.

**How to apply:**

1. Mark every screen-only element with `no-print`.
2. Wrap each page’s screen content in a single `no-print` wrapper so nothing leaks through.
3. Add `no-print` to the app shell sidebar and header in `AppLayout.tsx`.
4. In `@media print` CSS, keep A4 documents statically positioned and use a temporary receipt-mode class to reveal only the 72 mm receipt surface. Reset nested app-shell scrolling in receipt mode instead of using fixed full-viewport positioning.
5. Keep print colors dark-on-light (e.g. `text-black`, `text-black/70`) because the document prints on a white page even though the app uses a dark theme.

Do not rely on `hidden print:block` alone; it shows the document but does not hide the rest of the page. Fixed full-viewport receipt containers can also create duplicate or blank pages when an app shell has its own scrolling container.
