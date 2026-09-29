import { apiUrl } from './api';
import { ConnectionState, SyncOperation, SyncState } from '../types';
import { localDB, StoreName } from './db';

type SyncListener = () => void;
type StatusListener = (connection: ConnectionState, sync: SyncState, pendingCount: number) => void;

class SyncManager {
  private deviceId: string = '';
  private deviceName: string = '';
  private isSimulatedOffline: boolean = false;
  private isOnline: boolean = navigator.onLine;
  private syncState: SyncState = 'synced';
  private connectionState: ConnectionState = navigator.onLine ? 'connected' : 'disconnected';
  private pendingCount: number = 0;
  private lastPulledAt: number = 0;
  private isSyncInProgress: boolean = false;
  private sseSource: EventSource | null = null;
  private retryTimeout: any = null;

  private dataListeners: Set<SyncListener> = new Set();
  private statusListeners: Set<StatusListener> = new Set();

  async init() {
    // Generate or retrieve persistent device ID
    let storedDeviceId = await localDB.getMeta<string>('deviceId', '');
    if (!storedDeviceId) {
      storedDeviceId = `device_${Math.random().toString(36).substring(2, 8)}`;
      await localDB.setMeta('deviceId', storedDeviceId);
    }
    this.deviceId = storedDeviceId;

    let storedDeviceName = await localDB.getMeta<string>('deviceName', '');
    if (!storedDeviceName) {
      storedDeviceName = 'الجهاز الرئيسي (أ)';
      await localDB.setMeta('deviceName', storedDeviceName);
    }
    this.deviceName = storedDeviceName;

    this.isSimulatedOffline = await localDB.getMeta<boolean>('isSimulatedOffline', false);
    this.lastPulledAt = await localDB.getMeta<number>('lastPulledAt', 0);

    this.updateConnectionState();
    await this.updatePendingCount();

    // Listen to native browser online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.updateConnectionState();
      this.triggerSync();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.updateConnectionState();
    });

    // Listen to visibilitychange (return from background)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.updateConnectionState();
        this.triggerSync();
      }
    });

    window.addEventListener('focus', () => {
      this.updateConnectionState();
      this.triggerSync();
    });

    // Connect SSE if online
    this.setupSSE();

    // Initial sync
    setTimeout(() => {
      this.triggerSync();
    }, 500);

    // Periodic heartbeat sync every 25 seconds
    setInterval(() => {
      if (this.connectionState === 'connected' && !this.isSyncInProgress) {
        this.triggerSync();
      }
    }, 25000);
  }

  // Device & Offline Simulation controls
  getDeviceId(): string {
    return this.deviceId;
  }

  getDeviceName(): string {
    return this.deviceName;
  }

  async setDeviceProfile(id: string, name: string) {
    this.deviceId = id;
    this.deviceName = name;
    await localDB.setMeta('deviceId', id);
    await localDB.setMeta('deviceName', name);
    this.setupSSE();
    this.notifyStatus();
  }

  isOfflineMode(): boolean {
    return this.isSimulatedOffline || !this.isOnline;
  }

  async setSimulatedOffline(offline: boolean) {
    this.isSimulatedOffline = offline;
    await localDB.setMeta('isSimulatedOffline', offline);
    this.updateConnectionState();
    if (!offline) {
      this.setupSSE();
      this.triggerSync();
    } else {
      if (this.sseSource) {
        this.sseSource.close();
        this.sseSource = null;
      }
    }
  }

  getSimulatedOffline(): boolean {
    return this.isSimulatedOffline;
  }

  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  getSyncState(): SyncState {
    return this.syncState;
  }

  getPendingCount(): number {
    return this.pendingCount;
  }

  subscribeData(listener: SyncListener): () => void {
    this.dataListeners.add(listener);
    return () => this.dataListeners.delete(listener);
  }

  subscribeStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    // Initial emission
    listener(this.connectionState, this.syncState, this.pendingCount);
    return () => this.statusListeners.delete(listener);
  }

  private notifyData() {
    this.dataListeners.forEach((l) => {
      try {
        l();
      } catch (e) {
        console.error('Error in data listener', e);
      }
    });
  }

  private notifyStatus() {
    this.statusListeners.forEach((l) => {
      try {
        l(this.connectionState, this.syncState, this.pendingCount);
      } catch (e) {
        console.error('Error in status listener', e);
      }
    });
  }

  private updateConnectionState() {
    const isConn = this.isOnline && !this.isSimulatedOffline;
    const newState: ConnectionState = isConn ? 'connected' : 'disconnected';
    if (newState !== this.connectionState) {
      this.connectionState = newState;
      if (newState === 'disconnected') {
        if (this.pendingCount > 0) {
          this.syncState = 'pending';
        }
      }
      this.notifyStatus();
    }
  }

  private async updatePendingCount() {
    const pending = await localDB.getPendingOperations();
    this.pendingCount = pending.length;
    if (this.pendingCount > 0 && this.syncState !== 'syncing') {
      this.syncState = 'pending';
    } else if (this.pendingCount === 0 && this.syncState !== 'syncing' && this.syncState !== 'failed') {
      this.syncState = 'synced';
    }
    this.notifyStatus();
  }

  private setupSSE() {
    if (this.sseSource) {
      this.sseSource.close();
      this.sseSource = null;
    }

    if (this.isOfflineMode()) return;

    try {
      this.sseSource = new EventSource(apiUrl(`/api/sync/events?deviceId=${encodeURIComponent(this.deviceId)}`));

      this.sseSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          // If remote update occurred on another device or restore happened
          if (payload.type === 'REMOTE_UPDATE' || payload.type === 'RESTORE_COMPLETE' || payload.type === 'DATABASE_CLEARED') {
            if (payload.originDeviceId !== this.deviceId) {
              this.triggerSync();
            }
          }
        } catch (e) {
          console.error('Error handling SSE message', e);
        }
      };

      this.sseSource.onerror = () => {
        // SSE handles reconnection automatically
      };
    } catch (e) {
      console.warn('SSE setup warning:', e);
    }
  }

  // Queue a local operation and immediately attempt sync if connected
  async queueOperation(collection: StoreName, action: 'UPSERT' | 'DELETE', entity: any) {
    const op: SyncOperation = {
      opId: `op_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      collection,
      action,
      entity,
      timestamp: Date.now(),
      state: 'pending',
      retryCount: 0,
    };

    await localDB.queueSyncOperation(op);
    await this.updatePendingCount();

    // Trigger sync immediately
    if (this.connectionState === 'connected') {
      this.triggerSync();
    }
  }

  // Main idempotent synchronization cycle
  async triggerSync(): Promise<boolean> {
    if (this.isOfflineMode()) {
      await this.updatePendingCount();
      return false;
    }

    if (this.isSyncInProgress) {
      return false;
    }

    this.isSyncInProgress = true;
    this.syncState = 'syncing';
    this.notifyStatus();

    try {
      // 1. PUSH PENDING LOCAL OPERATIONS
      const pendingOps = await localDB.getPendingOperations();
      if (pendingOps.length > 0) {
        const response = await fetch(apiUrl('/api/sync/push') , {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceId: this.deviceId,
            operations: pendingOps,
          }),
        });

        if (!response.ok) {
          throw new Error(`Push failed with HTTP ${response.status}`);
        }

        const pushResult = await response.json();
        if (pushResult.success && Array.isArray(pushResult.syncedOpIds)) {
          await localDB.removeSyncOperations(pushResult.syncedOpIds);
        }
      }

      // 2. PULL REMOTE CHANGES
      const pullResponse = await fetch(apiUrl(`/api/sync/pull?since=${this.lastPulledAt}&deviceId=${encodeURIComponent(this.deviceId)}`));
      if (!pullResponse.ok) {
        throw new Error(`Pull failed with HTTP ${pullResponse.status}`);
      }

      const pullResult = await responseDataSafe(pullResponse);
      if (pullResult.success && pullResult.changes) {
        let hasNewData = false;
        for (const [colName, items] of Object.entries(pullResult.changes)) {
          if (Array.isArray(items) && items.length > 0) {
            await localDB.putBatch(colName as StoreName, items);
            hasNewData = true;
          }
        }

        this.lastPulledAt = pullResult.serverTime || Date.now();
        await localDB.setMeta('lastPulledAt', this.lastPulledAt);

        if (hasNewData) {
          this.notifyData();
        }
      }

      await this.updatePendingCount();
      this.syncState = 'synced';
      this.connectionState = 'connected';
      this.notifyStatus();
      this.isSyncInProgress = false;
      return true;
    } catch (err) {
      console.warn('Sync failed (will auto-retry):', err);
      await this.updatePendingCount();
      this.syncState = this.pendingCount > 0 ? 'failed' : 'synced';
      this.notifyStatus();
      this.isSyncInProgress = false;

      // Schedule auto-retry in 8 seconds
      clearTimeout(this.retryTimeout);
      this.retryTimeout = setTimeout(() => {
        if (this.connectionState === 'connected') {
          this.triggerSync();
        }
      }, 8000);

      return false;
    }
  }
}

async function responseDataSafe(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { success: false, error: text };
  }
}

export const syncManager = new SyncManager();
