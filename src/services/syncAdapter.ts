import type { SyncStatus } from '../types/models';

/**
 * Modular Sync Adapter contract.
 * Phase 1 runs 100% locally via IndexedDB.
 * Phase 4 will attach seamless single-sign-on cloud sync here without changing UI components.
 */
export interface SyncAdapter {
  getStatus(): SyncStatus;
  triggerSync(): Promise<SyncStatus>;
}

class LocalOnlySyncAdapter implements SyncAdapter {
  getStatus(): SyncStatus {
    return {
      state: 'local-only',
      providerName: 'Almacenamiento Local Offline',
    };
  }

  async triggerSync(): Promise<SyncStatus> {
    return this.getStatus();
  }
}

export const syncAdapter: SyncAdapter = new LocalOnlySyncAdapter();
