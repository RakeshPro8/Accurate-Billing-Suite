# Mobilinq print-preview verification

Mobilinq does not connect directly to USB, Bluetooth, or network printers. The
checks below verify the browser print surface and lifecycle; the final printer
selection is still made in the browser or operating system.

## Automated browser matrix

Run the browser-driven check from the workspace root:

```sh
pnpm --filter @workspace/billing-app exec playwright install chromium firefox webkit
pnpm --filter @workspace/billing-app run test:browser
```

The Playwright projects cover **Chromium**, **Firefox**, and **WebKit**. The
test harness imports the production `ReceiptPrint` component and
`startThermalPrint` implementation, then verifies:

- sale and quotation receipt previews use the 80 mm `@page` rule;
- the receipt surface is the only visible printable surface;
- the app shell, controls, and all A4 surfaces are hidden in thermal mode;
- `afterprint` completion, explicit cancellation, and print-media returning to
  screen all remove the receipt mode class and injected stylesheet;
- A4 invoice, quotation, and repair-ticket surfaces remain static, visible, and
  isolated when thermal mode is not active.
- long sale (18 items) and quotation (20 items) fixtures keep every item within
  the 72 mm receipt surface; Chromium also exports each through the
  representative 80 mm PDF profile below and checks that every item appears
  exactly once across multiple pages.

WebKit requires its host compatibility libraries in the browser-test
environment. On Debian-based CI images, install them with Playwright's
`install-deps` support before running the matrix. The release gate performs
this setup and runs the complete matrix with:

```sh
pnpm --filter @workspace/billing-app run test:browser:release
```

The root `pnpm run release:check` invokes that release command after the
typecheck and API build, so a browser-specific failure blocks release
validation. The release check clears old reports before starting. On failure it
copies the traces and HTML report into a run-specific `release-evidence/`
directory, writes a linked `README.md` manifest, and creates a matching
archive. Configure the release validation environment to retain that directory
and archive for at least the documented retention period. Set
`RELEASE_EVIDENCE_URL` when the provider has an artifact URL so the release
output includes a directly navigable link. Successful runs remove all
release-evidence output and raw Playwright reports, preventing stale evidence
from being surfaced.

## Manual thermal receipt (80 mm)

1. Open a loaded sale or quotation detail page and click **Print Receipt
   (TSP100)**.
2. In the browser preview, choose the thermal printer or **Save to PDF**.
3. Set paper size to **80 mm** (or **80 mm × Auto / Receipt**), leave margins
   at the browser's default so the receipt stylesheet can apply **4 mm
   left/right and 6 mm bottom**, and use scale **100%**.
4. Confirm the preview contains exactly one receipt surface with the saved
   business name/logo when available, document number, date, customer fallback
   when empty, every line item, discount, the stored tax total/rate, total,
   QR code, and footer.
5. Confirm the sidebar, app header, dashboard/detail cards, buttons, and the
   hidden A4 document are absent. Confirm a long item name wraps instead of
   widening the receipt.
6. Cancel the preview and confirm the detail page returns to its normal screen
   state. Repeat the action and complete a second preview to verify no stale
   print mode or duplicate page remains.

### Approved long-receipt profile

The approved stress profile is **80 mm paper width × 100 mm fixed page height**,
with **4 mm top/right/left margins, 6 mm bottom margin, scale 100%, and
background printing enabled**. This is a deliberately short page height that
forces page cuts in the PDF while retaining the physical printer's 80 mm roll
width. The expected result for both the 18-item sale and 20-item quotation is
multiple pages with:

- each item name, description, quantity, and amount together on one page;
- every item appearing exactly once, with no clipped text or duplicate item;
- no content outside the 72 mm receipt surface;
- totals, QR code, and footer appearing after the final item; and
- no blank leading or trailing page.

For a physical Star TSP100/FuturePRNT-style 80 mm roll, choose **80 mm /
Receipt or Auto**, **scale 100%**, **4 mm left/right and 6 mm bottom margins**,
and allow the printer driver to paginate/cut the continuous roll. The browser
print preview should match the PDF profile's item order and page-break behavior;
the physical driver may choose different cut points, but must not split an item.

### Physical Star TSP100 sign-off record

**Status: pending physical hardware access.** This workspace does not expose a
Star TSP100/FuturePRNT printer, an operating-system printer queue, or a USB/
serial printer device. No driver version or physical output result is recorded;
the automated browser/PDF checks must not be treated as hardware signoff.

Complete this record on a representative Star TSP100/FuturePRNT setup:

| Field | Signoff value |
| --- | --- |
| Printer model and connection | _Record exact model and USB/network connection_ |
| Driver / FuturePRNT version | _Record installed version_ |
| Paper profile | 80 mm / Receipt or Auto |
| Browser scale and margins | 100%; 4 mm top/right/left; 6 mm bottom |
| Background printing | Enabled |
| Long sale result | _Confirm 18 items, totals, QR code, and footer; no split items or blank cuts_ |
| Long quotation result | _Confirm 20 items, totals, QR code, and footer; no split items or blank cuts_ |
| Operator and date | _Record signoff owner and date_ |

## Invoice, quotation, and repair A4 output

1. From a sale or quotation detail page, click the normal **Print** action
   (**Print Invoice** for sales).
2. Leave the paper size at **A4** and confirm the document keeps its existing
   A4 layout without the thermal receipt or app shell.
3. From a repair detail page, click **Print** and confirm only the repair
   ticket prints.

## Edge-case fixture

The automated fixture includes a missing logo, no customer, zero tax, 14
items, a long item name and description, a discount, and QR content for both
the sale and quotation receipt paths. Historical tax output must remain the
amount and rate stored on the document even if current settings have different
GST/QST values.