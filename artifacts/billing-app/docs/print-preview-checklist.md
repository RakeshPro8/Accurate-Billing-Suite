# Mobilinq print-preview verification

Use a Chromium-based browser with the OS-installed thermal printer driver
available. This verifies browser print output only; Mobilinq does not connect
directly to USB, Bluetooth, or network printers.

## Thermal receipt (80 mm)

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

## Invoice, quotation, and repair A4 output

1. From a sale or quotation detail page, click the normal **Print** action
   (**Print Invoice** for sales).
2. Leave the paper size at **A4** and confirm the document keeps its existing
   A4 layout without the thermal receipt or app shell.
3. From a repair detail page, click **Print** and confirm only the repair
   ticket prints.

## Edge cases

Repeat the thermal check with a missing logo, no customer, a zero-tax
document, many items, a long item name, and a document that includes a QR
code. Historical tax output must remain the amount and rate stored on the
document even if current settings have different GST/QST values.