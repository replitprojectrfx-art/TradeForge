/**
 * Storage Abstraction Layer
 * لایه انتزاعی ذخیره‌سازی — برای آماده‌سازی جهت Android
 *
 * وب: از localStorage استفاده می‌کند
 * Android (آینده): می‌توان با SharedPreferences یا SQLite جایگزین کرد
 */

export interface IKeyValueStore {
  get<T = string>(key: string): T | null;
  set<T = string>(key: string, value: T): void;
  remove(key: string): void;
  clear(): void;
  keys(): string[];
}

// ── پیاده‌سازی وب (localStorage)
class LocalStorageAdapter implements IKeyValueStore {
  private prefix: string;

  constructor(prefix = 'tradermind') {
    this.prefix = prefix;
  }

  private k(key: string) { return `${this.prefix}-${key}`; }

  get<T = string>(key: string): T | null {
    try {
      const raw = localStorage.getItem(this.k(key));
      if (raw === null) return null;
      try { return JSON.parse(raw) as T; } catch { return raw as unknown as T; }
    } catch { return null; }
  }

  set<T = string>(key: string, value: T): void {
    try {
      localStorage.setItem(this.k(key), typeof value === 'string' ? value : JSON.stringify(value));
    } catch (e: any) {
      if (e?.name === 'QuotaExceededError') {
        throw new Error('فضای ذخیره‌سازی دستگاه پر است. لطفاً فضای آزاد کنید.');
      }
      throw e;
    }
  }

  remove(key: string): void {
    try { localStorage.removeItem(this.k(key)); } catch { /* ignore */ }
  }

  clear(): void {
    const toRemove = this.keys();
    toRemove.forEach(k => localStorage.removeItem(this.k(k)));
  }

  keys(): string[] {
    const prefix = this.k('');
    return Object.keys(localStorage)
      .filter(k => k.startsWith(prefix))
      .map(k => k.slice(prefix.length));
  }
}

// ── Singleton instances
export const kvStore: IKeyValueStore = new LocalStorageAdapter('tradermind');

// ── کمک‌های اختصاصی
export const appStorage = {
  getLastBackupDate: (): string | null => kvStore.get('last-backup'),
  setLastBackupDate: (iso: string) => kvStore.set('last-backup', iso),

  getBackupHistory: (): any[] => kvStore.get<any[]>('backup-history') ?? [],
  setBackupHistory: (history: any[]) => kvStore.set('backup-history', history),

  clearCache: () => {
    kvStore.remove('last-backup');
    kvStore.remove('backup-history');
  },

  /** تخمین حجم کلی داده‌های ذخیره‌شده */
  estimateSize: async (): Promise<number> => {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const est = await navigator.storage.estimate();
      return est.usage ?? 0;
    }
    // fallback: تخمین از localStorage
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) ?? '';
      total += key.length + (localStorage.getItem(key)?.length ?? 0);
    }
    return total * 2; // UTF-16
  },
};
