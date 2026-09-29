import { AppStateData, SyncOperation } from '../types';

const DB_NAME = 'power_h_db';
const DB_VERSION = 1;

const STORES = [
  'customers',
  'suppliers',
  'fakeCustomers',
  'inventoryItems',
  'inventoryMovements',
  'salesInvoices',
  'purchaseInvoices',
  'salesReturns',
  'purchaseReturns',
  'deposits',
  'expenses',
  'transfers',
  'financialTransactions',
  'operationLogs',
  'syncQueue',
  'meta',
] as const;

export type StoreName = (typeof STORES)[number];

class LocalDatabase {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = request.result;
        STORES.forEach((storeName) => {
          if (!db.objectStoreNames.contains(storeName)) {
            const keyPath = storeName === 'syncQueue' ? 'opId' : storeName === 'meta' ? 'key' : 'id';
            db.createObjectStore(storeName, { keyPath });
          }
        });
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  async getAll<T>(storeName: StoreName, includeDeleted = false): Promise<T[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        const items = request.result as any[];
        if (includeDeleted || storeName === 'syncQueue' || storeName === 'meta') {
          resolve(items as T[]);
        } else {
          resolve(items.filter((item) => !item.deleted) as T[]);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async getById<T>(storeName: StoreName, id: string): Promise<T | null> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => reject(request.error);
    });
  }

  async put<T extends { id?: string; opId?: string; key?: string }>(storeName: StoreName, item: T): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(item);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async putBatch(storeName: StoreName, items: any[]): Promise<void> {
    if (!items.length) return;
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);

      items.forEach((item) => store.put(item));

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async delete(storeName: StoreName, key: string): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clearStore(storeName: StoreName): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clearAllData(): Promise<void> {
    for (const store of STORES) {
      if (store !== 'meta') {
        await this.clearStore(store);
      }
    }
  }

  // Meta helpers
  async getMeta<T>(key: string, defaultValue: T): Promise<T> {
    try {
      const res = await this.getById<{ key: string; value: T }>('meta', key);
      return res ? res.value : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  async setMeta<T>(key: string, value: T): Promise<void> {
    await this.put('meta', { key, value });
  }

  // Sync Queue Helpers
  async queueSyncOperation(op: SyncOperation): Promise<void> {
    await this.put('syncQueue', op);
  }

  async getPendingOperations(): Promise<SyncOperation[]> {
    const all = await this.getAll<SyncOperation>('syncQueue', true);
    return all.sort((a, b) => a.timestamp - b.timestamp);
  }

  async removeSyncOperations(opIds: string[]): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('syncQueue', 'readwrite');
      const store = transaction.objectStore('syncQueue');
      opIds.forEach((id) => store.delete(id));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // Export full snapshot for backup
  async exportFullSnapshot(): Promise<AppStateData> {
    const data: any = {};
    for (const store of STORES) {
      if (store !== 'syncQueue' && store !== 'meta') {
        data[store] = await this.getAll(store, true);
      }
    }
    return data as AppStateData;
  }

  // Restore snapshot with safe merge
  async restoreSnapshot(snapshot: AppStateData): Promise<number> {
    let count = 0;
    for (const [storeName, items] of Object.entries(snapshot)) {
      if (STORES.includes(storeName as StoreName) && Array.isArray(items)) {
        await this.putBatch(storeName as StoreName, items);
        count += items.length;
      }
    }
    return count;
  }
}

export const localDB = new LocalDatabase();
