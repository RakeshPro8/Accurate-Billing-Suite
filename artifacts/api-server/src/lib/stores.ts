import { db, settingsTable, storesTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import type { Request } from "express";
import { HttpError } from "./http";

export async function getCurrentStoreId(req: Request): Promise<number | null> {
  if (req.session?.storeScopeAll) return null;
  if (req.session?.storeId) {
    const [activeStore] = await db.select({ id: storesTable.id }).from(storesTable)
      .where(and(eq(storesTable.id, req.session.storeId), eq(storesTable.active, true))).limit(1);
    return activeStore?.id ?? null;
  }
  const [settings] = await db.select({ defaultStoreId: settingsTable.defaultStoreId })
    .from(settingsTable).limit(1);
  if (settings?.defaultStoreId) {
    const [activeStore] = await db.select({ id: storesTable.id }).from(storesTable)
      .where(and(eq(storesTable.id, settings.defaultStoreId), eq(storesTable.active, true))).limit(1);
    if (activeStore) return activeStore.id;
  }
  const [store] = await db.select({ id: storesTable.id }).from(storesTable)
    .where(and(eq(storesTable.isDefault, true), eq(storesTable.active, true))).limit(1);
  return store?.id ?? null;
}

export async function requireCurrentStoreId(req: Request): Promise<number> {
  const storeId = await getCurrentStoreId(req);
  if (!storeId) {
    throw new HttpError(409, "Select an active store before continuing.", "STORE_SCOPE_REQUIRED");
  }
  return storeId;
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