---
name: BillPro Employee Auth Design
description: How employee sign-in and discount enforcement works in BillPro.
---

## Design Decision: PIN-based session, not JWT
Employees select their name from a list and enter a 4-8 digit PIN. On success:
- Employee data stored in `localStorage` under key `billpro_active_employee`
- Exposed app-wide via `EmployeeContext` + `useEmployee()` hook
- No server session — stateless, zero-dependency approach

**Why:** Full OAuth/JWT adds significant complexity for a local POS tool where employees share a device. PIN-per-shift is standard retail POS UX.

## Discount Enforcement
- Each employee has `maxDiscountPct` (e.g. 10% for staff, 25% for manager, 100% for admin)
- SaleForm computes `discountPct = (discount / subtotal) * 100` and shows a warning + blocks submit if it exceeds the active employee's limit
- Server also validates: `POST /api/sales` checks employee's `maxDiscountPct` if `employeeId` is provided and rejects with 403 if exceeded

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
