/**
 * Shared vocabulary for mobile capability checks, cache/outbox UI, and
 * server responses. Keeping these labels in the API client prevents native
 * and web clients from drifting into different meanings for the same state.
 */
export type MobileCapability =
  | 'dashboard.read'
  | 'customers.read'
  | 'customers.create'
  | 'repairs.read'
  | 'repairs.create'
  | 'repairs.update'
  | 'repairs.photo'
  | 'inventory.read'
  | 'inventory.adjust'
  | 'sales.read'
  | 'sales.create'
  | 'notifications.manage';

export type MobileOfflineStatus =
  | 'live'
  | 'stale'
  | 'pending'
  | 'syncing'
  | 'completed'
  | 'error'
  | 'conflict';

export type MobileScope = {
  employeeId: number;
  storeId: number | null;
};

export const MOBILE_OFFLINE_SCHEMA_VERSION = 1;
export const MOBILE_MAX_REPLAY_BATCH = 25;
export const MOBILE_MAX_RETRY_ATTEMPTS = 3;