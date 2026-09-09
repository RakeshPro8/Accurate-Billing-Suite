import { z } from "zod";

export const recyclingCondition = z.enum(["working", "damaged", "bricked", "unknown"]);
const nullableId = z.union([z.coerce.number().int().positive(), z.null()]);
const text = (max: number) => z.string().trim().min(1).max(max);
const email = z.string().trim().email().max(254);

export const recyclingReceiptInput = z.object({
  saleId: z.coerce.number().int().positive().optional(),
  customerId: z.coerce.number().int().positive().optional(),
  customerName: text(200),
  customerPhone: text(50),
  customerEmail: email.optional(),
  deviceType: text(100),
  deviceBrand: text(100),
  deviceModel: text(150),
  deviceColour: text(100),
  declaredCondition: recyclingCondition,
  accessories: text(500),
  serialOrImei: z.string().trim().max(150).optional(),
  handoffDate: z.string().date(),
}).strict();

export const recyclingReceiptUpdate = recyclingReceiptInput.omit({ saleId: true }).partial().extend({
  customerId: nullableId.optional(),
  customerEmail: z.union([email, z.null()]).optional(),
  serialOrImei: z.union([z.string().trim().max(150), z.null()]).optional(),
}).strict();
