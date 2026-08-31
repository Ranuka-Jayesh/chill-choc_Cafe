import { DatabaseSchema, INITIAL_DATABASE, generateSampleSeedData } from './mockDb';
import { realtimeSocketService } from '../realtimeSocketService';

const STORAGE_KEY = 'chill_choc_cafe_db_v1';
const DB_CHANGE_EVENT = 'chill_choc_db_changed';

class DatabaseManager {
  private db: DatabaseSchema;
  private listeners: Set<() => void> = new Set();
  private isSyncingFromRemote: boolean = false;
  private lastStorageString: string = '';

  constructor() {
    this.db = this.loadDatabase();

    if (typeof window !== 'undefined') {
      // 1. Native cross-tab storage event (fires across browser tabs)
      window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY) {
          this.syncFromStorage();
        }
      });

      // 2. Real-time Cluster WebSocket BroadcastChannel receiver
      // Listen to ANY incoming cluster event to ensure DB is re-synced immediately
      realtimeSocketService.on('*', () => {
        if (!this.isSyncingFromRemote) {
          this.syncFromStorage();
        }
      });

      // 3. Tab focus & visibility change sync
      window.addEventListener('focus', () => {
        this.syncFromStorage();
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.syncFromStorage();
        }
      });
    }
  }

  public syncFromStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw && raw !== this.lastStorageString) {
        this.isSyncingFromRemote = true;
        this.lastStorageString = raw;
        const parsed = JSON.parse(raw);
        this.db = {
          ...INITIAL_DATABASE,
          ...parsed,
        };
        this.notifyListeners();
        this.isSyncingFromRemote = false;
      }
    } catch (e) {
      console.error('Error syncing from storage', e);
      this.isSyncingFromRemote = false;
    }
  }

  private loadDatabase(): DatabaseSchema {
    if (typeof window === 'undefined') {
      const sample = generateSampleSeedData();
      return {
        ...INITIAL_DATABASE,
        ...sample,
      };
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const sample = generateSampleSeedData();

      if (!raw) {
        const seededDb: DatabaseSchema = {
          ...INITIAL_DATABASE,
          ...sample,
        };
        this.lastStorageString = JSON.stringify(seededDb);
        this.saveDatabase(seededDb, false);
        return seededDb;
      }

      this.lastStorageString = raw;
      const parsed = JSON.parse(raw);

      // If user has 0 orders or 0 expenses in storage, auto-seed with rich demo data
      const needsSeed =
        !parsed.orders ||
        parsed.orders.length === 0 ||
        !parsed.expenses ||
        parsed.expenses.length === 0;

      const mergedProducts = (parsed.products && parsed.products.length > 0 ? parsed.products : INITIAL_DATABASE.products).map((p: any) =>
        p.id === 'prod_hot_chocolate' ? { ...p, isSoldOut: true } : p
      );

      const merged: DatabaseSchema = {
        ...INITIAL_DATABASE,
        ...parsed,
        products: mergedProducts,
        orders: parsed.orders && parsed.orders.length > 0 ? parsed.orders : sample.orders,
        expenses: parsed.expenses && parsed.expenses.length > 0 ? parsed.expenses : sample.expenses,
        shifts: parsed.shifts && parsed.shifts.length > 0 ? parsed.shifts : sample.shifts,
        activeShift: parsed.activeShift || sample.activeShift,
        drawerTransactions:
          parsed.drawerTransactions && parsed.drawerTransactions.length > 0
            ? parsed.drawerTransactions
            : sample.drawerTransactions,
        inventoryMovements:
          parsed.inventoryMovements && parsed.inventoryMovements.length > 0
            ? parsed.inventoryMovements
            : sample.inventoryMovements,
      };

      if (needsSeed) {
        this.saveDatabase(merged, false);
      }

      return merged;
    } catch (e) {
      console.error('Failed to load database from localStorage, resetting to default', e);
      const sample = generateSampleSeedData();
      return {
        ...INITIAL_DATABASE,
        ...sample,
      };
    }
  }

  private saveDatabase(data: DatabaseSchema, broadcast: boolean = true): void {
    if (typeof window === 'undefined') return;
    try {
      const serialized = JSON.stringify(data);
      this.lastStorageString = serialized;
      localStorage.setItem(STORAGE_KEY, serialized);
      this.notifyListeners();
      if (broadcast && !this.isSyncingFromRemote) {
        realtimeSocketService.emitDatabaseSync();
      }
    } catch (e) {
      console.error('Failed to persist database to localStorage', e);
    }
  }

  public getSnapshot(): DatabaseSchema {
    // Quick auto-refresh if storage was modified
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw && raw !== this.lastStorageString) {
          this.lastStorageString = raw;
          this.db = {
            ...INITIAL_DATABASE,
            ...JSON.parse(raw),
          };
        }
      } catch {}
    }
    return this.db;
  }

  public update<K extends keyof DatabaseSchema>(
    key: K,
    updater: (current: DatabaseSchema[K]) => DatabaseSchema[K]
  ): DatabaseSchema[K] {
    // Reload freshest data first to prevent overwriting updates from other tabs
    this.getSnapshot();

    const updatedValue = updater(this.db[key]);
    this.db = {
      ...this.db,
      [key]: updatedValue,
    };
    this.saveDatabase(this.db);
    return updatedValue;
  }

  public mutate(mutator: (draft: DatabaseSchema) => void): DatabaseSchema {
    // Reload freshest data first
    this.getSnapshot();

    const draft = JSON.parse(JSON.stringify(this.db)) as DatabaseSchema;
    mutator(draft);
    this.db = draft;
    this.saveDatabase(this.db);
    return this.db;
  }

  public reset(): void {
    const sample = generateSampleSeedData();
    this.db = {
      ...JSON.parse(JSON.stringify(INITIAL_DATABASE)),
      ...sample,
    };
    this.saveDatabase(this.db);
  }

  public seedDummyData(): void {
    const sample = generateSampleSeedData();
    this.db = {
      ...this.db,
      ...sample,
    };
    this.saveDatabase(this.db);
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('Error in db listener', err);
      }
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(DB_CHANGE_EVENT));
    }
  }
}

export const db = new DatabaseManager();
