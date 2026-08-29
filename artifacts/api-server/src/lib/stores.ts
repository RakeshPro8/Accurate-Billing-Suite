import { db, settingsTable, storesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request } from "express";

export async function getCurrentStoreId(req: Request): Promise<number | null> {
  if (req.session?.storeScopeAll) return null;
  if (req.session?.storeId) return req.session.storeId;
  const [settings] = await db.select({ defaultStoreId: settingsTable.defaultStoreId })
    .from(settingsTable).limit(1);
  if (settings?.defaultStoreId) return settings.defaultStoreId;
  const [store] = await db.select({ id: storesTable.id }).from(storesTable)
    .where(eq(storesTable.isDefault, true)).limit(1);
  return store?.id ?? null;
}

export async function setCurrentStoreId(req: Request, storeId: number | null) {
  if (storeId === null) {
    delete req.session.storeId;
    req.session.storeScopeAll = true;
  } else {
    req.session.storeId = storeId;
    req.session.storeScopeAll = false;
  }
  await new Promise<void>((resolve, reject) => {
    req.session.save((error) => error ? reject(error) : resolve());
  });
}