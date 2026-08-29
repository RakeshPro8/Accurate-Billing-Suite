---
name: BillPro Employee Auth Design
description: How employee sign-in and discount enforcement works in BillPro.
---

## Design Decision: PIN-based server session, not JWT
Employees select their name from a list and enter a 4-8 digit PIN. On success, the server rotates and persists an httpOnly session cookie; the client keeps only the public profile in `EmployeeContext`.

**Why:** Full OAuth/JWT adds significant complexity for a local POS tool where employees share a device, while a server session lets the API enforce deactivation, expiration, and role boundaries.

**How to apply:** Keep identity, discount authority, and attribution server-derived from the active session. Never reintroduce localStorage employee identity or a client-trusted employee ID for protected writes.

## Discount Enforcement
- Each employee has `maxDiscountPct` (e.g. 10% for staff, 25% for manager, 100% for admin)
- SaleForm computes `discountPct = (discount / subtotal) * 100` and shows a warning + blocks submit if it exceeds the active employee's limit
- Server also validates: `POST /api/sales` derives the employee and `maxDiscountPct` from the active session and rejects over-limit discounts with 403

## Loyalty Discounts
- Customers have `isLoyaltyMember` + `loyaltyDiscountPct` fields
- In SaleForm, selecting a loyalty customer shows an amber banner with an "Apply" button that auto-fills the discount field
- Loyalty discounts count toward the employee's discount cap (prevents abuse)

## Files
- Context: `artifacts/billing-app/src/context/EmployeeContext.tsx`
- PIN dialog: `artifacts/billing-app/src/components/EmployeePinDialog.tsx`
- Custom API hooks: `artifacts/billing-app/src/lib/employees-api.ts`
- Page: `artifacts/billing-app/src/pages/Employees.tsx`
- API route: `artifacts/api-server/src/routes/employees.ts`
