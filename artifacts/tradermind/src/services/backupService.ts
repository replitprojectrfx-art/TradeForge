import JSZip from 'jszip';
import { db } from '../db/database';
import { securityService } from '../security/securityService';
import { APP_VERSION, DB_VERSION, BACKUP_FORMAT_VERSION } from '../constants/version';

export { APP_VERSION, DB_VERSION, BACKUP_FORMAT_VERSION };

const STORAGE_KEY_HISTORY = 'tradermind-backup-history';
const STORAGE_KEY_APP = 'tradermind-app-storage';
const STORAGE_KEY_LAST = 'tradermind-last-backup';

// ─────────────────────────────────────────────
// انواع
// ─────────────────────────────────────────────
export interface BackupMetadata {
  appName: string;
  backupVersion: string;
  appVersion: string;
  databaseVersion: number;
  createdAt: string;
  totalRecords: number;
  /** SHA-256 از JSON رشته‌ای داده‌ها — برای بررسی یکپارچگی */
  checksum?: string;
  /** آیا داده‌ها رمزگذاری شده‌اند؟ */
  encrypted?: boolean;
}

export interface BackupData {
  metadata: BackupMetadata;
  data: {
    strategies: any[];
    phases: any[];
    steps: any[];
    rules: any[];
    analysisSessions: any[];
    trades: any[];
    dailyJournals: any[];
    settings: Record<string, string>;
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  metadata?: BackupMetadata;
  parsedData?: BackupData['data'];
  needsPassword?: boolean;
}

export interface MergeStats {
  added: number;
  updated: number;
  skipped: number;
}

export interface BackupHistoryItem {
  id: string;
  createdAt: string;
  size: number;
  type: 'export' | 'import';
  mode?: 'replace' | 'merge';
  status: 'success' | 'failed';
  recordCount: number;
  encrypted?: boolean;
}

// ─────────────────────────────────────────────
// ساخت payload داده
// ─────────────────────────────────────────────
async function buildBackupData() {
  const [strategies, phases, steps, rules, analysisSessions, trades, dailyJournals] =
    await Promise.all([
      db.strategies.toArray(),
      db.phases.toArray(),
      db.steps.toArray(),
      db.rules.toArray(),
      db.analysisSessions.toArray(),
      db.trades.toArray(),
      db.dailyJournals.toArray(),
    ]);

  const settings = backupService.exportSettings();
  const totalRecords =
    strategies.length + phases.length + steps.length + rules.length +
    analysisSessions.length + trades.length + dailyJournals.length;

  const data: BackupData['data'] = {
    strategies, phases, steps, rules, analysisSessions, trades, dailyJournals, settings,
  };

  // محاسبه Checksum برای بررسی یکپارچگی
  const dataJson = JSON.stringify(data);
  const checksum = await securityService.sha256(dataJson);

  const metadata: BackupMetadata = {
    appName: 'TraderMind',
    backupVersion: BACKUP_FORMAT_VERSION,
    appVersion: APP_VERSION,
    databaseVersion: DB_VERSION,
    createdAt: new Date().toISOString(),
    totalRecords,
    checksum,
  };

  return { data, metadata, totalRecords };
}

// ─────────────────────────────────────────────
// ساخت و دانلود ZIP
// ─────────────────────────────────────────────
async function buildAndDownloadZip(
  payload: BackupData,
  filename: string,
  trades: any[],
): Promise<number> {
  const zip = new JSZip();
  zip.file('backup.json', JSON.stringify(payload, null, 2));

  // تصاویر معاملات
  const mediaFolder = zip.folder('media');
  let mediaIndex = 1;
  for (const trade of trades) {
    if (trade.screenshots) {
      try {
        const screenshots: Array<{ id: string; dataUrl: string }> = JSON.parse(trade.screenshots);
        for (const sc of screenshots) {
          if (sc.dataUrl?.startsWith('data:')) {
            const ext = sc.dataUrl.split(';')[0].split('/')[1] || 'webp';
            const base64 = sc.dataUrl.split(',')[1];
            mediaFolder?.file(`image-${String(mediaIndex).padStart(3, '0')}.${ext}`, base64, { base64: true });
            mediaIndex++;
          }
        }
      } catch { /* تصویر نادرست نادیده گرفته می‌شود */ }
    }
  }

  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return zipBlob.size;
}

// ─────────────────────────────────────────────
// سرویس اصلی
// ─────────────────────────────────────────────
export const backupService = {
  // ────────── Export معمولی ──────────
  async exportAll(): Promise<void> {
    const { data, metadata, totalRecords } = await buildBackupData();
    const payload: BackupData = { metadata, data };

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 5).replace(':', '-');
    const filename = `TraderMind_Backup_${dateStr}_${timeStr}.zip`;

    const size = await buildAndDownloadZip(payload, filename, data.trades);

    localStorage.setItem(STORAGE_KEY_LAST, new Date().toISOString());
    this.addToHistory({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      size,
      type: 'export',
      status: 'success',
      recordCount: totalRecords,
    });
  },

  // ────────── Export رمزگذاری‌شده ──────────
  /**
   * Backup رمزگذاری‌شده با AES-GCM
   * داده‌ها با رمز عبور کاربر رمزگذاری می‌شوند.
   * بدون رمز، محتوا قابل خواندن نیست.
   */
  async exportEncrypted(password: string): Promise<void> {
    const { data, metadata, totalRecords } = await buildBackupData();

    const dataJson = JSON.stringify(data);
    const encryptedData = await securityService.encrypt(dataJson, password);

    const encPayload = {
      metadata: { ...metadata, encrypted: true, checksum: undefined },
      encryptedData,
    };

    const zip = new JSZip();
    zip.file('backup.json', JSON.stringify(encPayload, null, 2));

    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 5).replace(':', '-');
    const filename = `TraderMind_Backup_Encrypted_${dateStr}_${timeStr}.zip`;

    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    localStorage.setItem(STORAGE_KEY_LAST, new Date().toISOString());
    this.addToHistory({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      size: zipBlob.size,
      type: 'export',
      status: 'success',
      recordCount: totalRecords,
      encrypted: true,
    });
  },

  // ────────── رمزگشایی Backup رمزگذاری‌شده ──────────
  async decryptBackup(file: File, password: string): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    try {
      const zip = await JSZip.loadAsync(file);
      const jsonFile = zip.file('backup.json');
      if (!jsonFile) {
        errors.push('فایل backup.json در آرشیو یافت نشد.');
        return { valid: false, errors, warnings };
      }
      const jsonStr = await jsonFile.async('string');
      let parsed: any;
      try { parsed = JSON.parse(jsonStr); } catch {
        errors.push('فایل backup.json خراب است.');
        return { valid: false, errors, warnings };
      }

      if (!parsed?.metadata?.encrypted || !parsed.encryptedData) {
        errors.push('این فایل رمزگذاری‌شده نیست.');
        return { valid: false, errors, warnings };
      }

      let decryptedJson: string;
      try {
        decryptedJson = await securityService.decrypt(parsed.encryptedData, password);
      } catch {
        errors.push('رمز عبور صحیح نیست یا فایل قابل بازیابی نیست.');
        return { valid: false, errors, warnings };
      }

      let data: any;
      try { data = JSON.parse(decryptedJson); } catch {
        errors.push('داده‌های رمزگشایی‌شده خراب هستند.');
        return { valid: false, errors, warnings };
      }

      return { valid: true, errors, warnings, metadata: parsed.metadata, parsedData: data };
    } catch {
      errors.push('خطا در باز کردن فایل.');
      return { valid: false, errors, warnings };
    }
  },

  // ────────── تنظیمات ──────────
  exportSettings(): Record<string, string> {
    const settings: Record<string, string> = {};
    const val = localStorage.getItem(STORAGE_KEY_APP);
    if (val) settings[STORAGE_KEY_APP] = val;
    return settings;
  },

  importSettings(settings: Record<string, string>) {
    for (const [key, value] of Object.entries(settings)) {
      localStorage.setItem(key, value);
    }
  },

  // ────────── اعتبارسنجی ──────────
  async validateFile(file: File): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (file.name.endsWith('.json')) {
      return this.validateLegacyJson(file);
    }

    if (!file.name.endsWith('.zip') && file.type !== 'application/zip' && file.type !== 'application/x-zip-compressed') {
      errors.push('فرمت فایل پشتیبان پشتیبانی نمی‌شود. فایل باید ZIP یا JSON باشد.');
      return { valid: false, errors, warnings };
    }

    try {
      const zip = await JSZip.loadAsync(file);
      const backupJsonFile = zip.file('backup.json');
      if (!backupJsonFile) {
        errors.push('فایل backup.json در آرشیو پشتیبان یافت نشد.');
        return { valid: false, errors, warnings };
      }

      const jsonStr = await backupJsonFile.async('string');
      let parsed: any;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        errors.push('فایل backup.json خراب است و قابل خواندن نیست.');
        return { valid: false, errors, warnings };
      }

      // اگر رمزگذاری‌شده باشد، نیاز به رمز عبور دارد
      if (parsed?.metadata?.encrypted) {
        return {
          valid: true, errors, warnings,
          metadata: parsed.metadata,
          needsPassword: true,
        };
      }

      return this.validateParsed(parsed, errors, warnings);
    } catch {
      errors.push('خطا در باز کردن فایل ZIP. فایل ممکن است آسیب دیده باشد.');
      return { valid: false, errors, warnings };
    }
  },

  async validateLegacyJson(file: File): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (parsed.version === 1 || parsed.exportedAt) {
        warnings.push('فایل پشتیبان از نسخه قدیمی برنامه است. برخی اطلاعات ممکن است ناقص باشد.');
        const data = {
          strategies: parsed.strategies || [],
          phases: parsed.phases || [],
          steps: parsed.steps || [],
          rules: parsed.rules || [],
          analysisSessions: parsed.analysisSessions || [],
          trades: parsed.trades || [],
          dailyJournals: parsed.dailyJournals || [],
          settings: {},
        };
        const total = Object.values(data).reduce((s, v) => s + (Array.isArray(v) ? v.length : 0), 0);
        return {
          valid: true, errors, warnings,
          metadata: {
            appName: 'TraderMind',
            backupVersion: '1.0',
            appVersion: 'قدیمی',
            databaseVersion: parsed.version || 1,
            createdAt: parsed.exportedAt ? new Date(parsed.exportedAt).toISOString() : new Date().toISOString(),
            totalRecords: total,
          },
          parsedData: data,
        };
      }

      errors.push('فایل پشتیبان معتبر نیست یا متعلق به برنامه دیگری است.');
      return { valid: false, errors, warnings };
    } catch {
      errors.push('فایل JSON خراب است و قابل خواندن نیست.');
      return { valid: false, errors, warnings };
    }
  },

  async validateParsed(parsed: any, errors: string[], warnings: string[]): Promise<ValidationResult> {
    if (!parsed?.metadata) {
      errors.push('ساختار فایل پشتیبان معتبر نیست (metadata یافت نشد).');
      return { valid: false, errors, warnings };
    }
    if (parsed.metadata.appName !== 'TraderMind') {
      errors.push('این فایل متعلق به برنامه دیگری است.');
      return { valid: false, errors, warnings };
    }
    if (!parsed.metadata.backupVersion) {
      errors.push('نسخه فایل پشتیبان مشخص نیست.');
      return { valid: false, errors, warnings };
    }
    if (!parsed.data) {
      errors.push('داده‌های پشتیبان یافت نشد.');
      return { valid: false, errors, warnings };
    }

    // بررسی Checksum (یکپارچگی داده)
    if (parsed.metadata.checksum) {
      try {
        const actualChecksum = await securityService.sha256(JSON.stringify(parsed.data));
        if (actualChecksum !== parsed.metadata.checksum) {
          errors.push('یکپارچگی فایل تأیید نشد — فایل احتمالاً تغییر کرده یا خراب است.');
          return { valid: false, errors, warnings };
        }
      } catch {
        warnings.push('بررسی یکپارچگی فایل ممکن نبود.');
      }
    }

    const requiredArrays = ['strategies', 'phases', 'steps', 'analysisSessions', 'trades', 'dailyJournals'];
    for (const key of requiredArrays) {
      if (parsed.data[key] !== undefined && !Array.isArray(parsed.data[key])) {
        errors.push(`ساختار داده‌های "${key}" معتبر نیست.`);
      }
    }
    if (errors.length > 0) return { valid: false, errors, warnings };

    // بررسی یکپارچگی روابط
    const strategyIds = new Set((parsed.data.strategies || []).map((s: any) => s.id));
    const phaseIds = new Set((parsed.data.phases || []).map((p: any) => p.id));
    const stepIds = new Set((parsed.data.steps || []).map((s: any) => s.id));

    const orphanPhases = (parsed.data.phases || []).filter((p: any) => p.strategyId && !strategyIds.has(p.strategyId));
    if (orphanPhases.length > 0) warnings.push(`${orphanPhases.length} فاز بدون استراتژی معتبر یافت شد.`);

    const orphanSteps = (parsed.data.steps || []).filter((s: any) => s.phaseId && !phaseIds.has(s.phaseId));
    if (orphanSteps.length > 0) warnings.push(`${orphanSteps.length} مرحله بدون فاز معتبر یافت شد.`);

    const orphanRules = (parsed.data.rules || []).filter((r: any) => r.stepId && !stepIds.has(r.stepId));
    if (orphanRules.length > 0) warnings.push(`${orphanRules.length} قانون بدون مرحله معتبر یافت شد.`);

    return { valid: true, errors, warnings, metadata: parsed.metadata, parsedData: parsed.data };
  },

  // ────────── جایگزینی کامل ──────────
  async importReplace(data: BackupData['data']): Promise<void> {
    await db.transaction('rw',
      [db.strategies, db.phases, db.steps, db.rules,
       db.analysisSessions, db.trades, db.dailyJournals],
      async () => {
        await Promise.all([
          db.strategies.clear(), db.phases.clear(), db.steps.clear(),
          db.rules.clear(), db.analysisSessions.clear(),
          db.trades.clear(), db.dailyJournals.clear(),
        ]);
        if (data.strategies?.length) await db.strategies.bulkAdd(data.strategies);
        if (data.phases?.length) await db.phases.bulkAdd(data.phases);
        if (data.steps?.length) await db.steps.bulkAdd(data.steps);
        if (data.rules?.length) await db.rules.bulkAdd(data.rules);
        if (data.analysisSessions?.length) await db.analysisSessions.bulkAdd(data.analysisSessions);
        if (data.trades?.length) await db.trades.bulkAdd(data.trades);
        if (data.dailyJournals?.length) await db.dailyJournals.bulkAdd(data.dailyJournals);
      }
    );
    if (data.settings) this.importSettings(data.settings);
  },

  // ────────── ادغام (Keep Newest) ──────────
  async importMerge(data: BackupData['data']): Promise<MergeStats> {
    const stats: MergeStats = { added: 0, updated: 0, skipped: 0 };

    const mergeTable = async (table: any, items: any[]) => {
      for (const item of items) {
        if (!item?.id) { stats.skipped++; continue; }
        const existing = await table.get(item.id);
        if (!existing) {
          await table.add(item);
          stats.added++;
        } else {
          const existingTime = existing.updatedAt ?? existing.createdAt ?? 0;
          const backupTime = item.updatedAt ?? item.createdAt ?? 0;
          if (backupTime > existingTime) {
            await table.put(item);
            stats.updated++;
          } else {
            stats.skipped++;
          }
        }
      }
    };

    await mergeTable(db.strategies, data.strategies || []);
    await mergeTable(db.phases, data.phases || []);
    await mergeTable(db.steps, data.steps || []);
    await mergeTable(db.rules, data.rules || []);
    await mergeTable(db.analysisSessions, data.analysisSessions || []);
    await mergeTable(db.trades, data.trades || []);
    await mergeTable(db.dailyJournals, data.dailyJournals || []);

    return stats;
  },

  // ────────── پاک کردن همه داده‌ها ──────────
  async resetAll(): Promise<void> {
    await db.transaction('rw',
      [db.strategies, db.phases, db.steps, db.rules,
       db.analysisSessions, db.trades, db.dailyJournals],
      async () => {
        await Promise.all([
          db.strategies.clear(), db.phases.clear(), db.steps.clear(),
          db.rules.clear(), db.analysisSessions.clear(),
          db.trades.clear(), db.dailyJournals.clear(),
        ]);
      }
    );
  },

  // ────────── تاریخچه ──────────
  getHistory(): BackupHistoryItem[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_HISTORY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  },

  addToHistory(item: BackupHistoryItem) {
    const history = this.getHistory();
    history.unshift(item);
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history.slice(0, 20)));
  },

  clearHistory() {
    localStorage.removeItem(STORAGE_KEY_HISTORY);
  },

  // ────────── خروجی Excel ──────────
  async exportToExcel(): Promise<void> {
    const trades = await db.trades.toArray();

    const rows = trades.map(t => ({
      تاریخ: t.openedAt ? new Date(t.openedAt).toLocaleDateString('fa-IR') : '',
      نماد: t.symbol,
      جهت: t.direction === 'long' ? 'خرید (Long)' : 'فروش (Short)',
      وضعیت: t.status,
      نتیجه: t.result,
      'سود/زیان (R)': t.rMultiple ?? '',
      'سود/زیان ($)': t.profitLoss ?? '',
      'نسبت R/R برنامه‌ریزی‌شده': t.plannedRR ?? '',
      'حجم موقعیت': t.positionSize ?? '',
      'ریسک %': t.riskPercentage ?? '',
      'قیمت ورود': t.entryPrice,
      'قیمت خروج': t.exitPrice ?? '',
      'حد ضرر': t.stopLoss,
      'هدف سود': t.takeProfit ?? '',
      'جلسه معاملاتی': t.tradingSession ?? '',
      ست‌آپ: t.setupType ?? '',
      'دلیل ورود': t.entryReason ?? '',
      'دلیل خروج': t.reasonForExit ?? '',
      یادداشت: t.notes ?? '',
      'درس‌آموخته': t.lesson ?? '',
    }));

    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'معاملات');

    // عرض ستون‌ها
    if (rows.length) {
      ws['!cols'] = Object.keys(rows[0]).map(() => ({ wch: 18 }));
    }

    const filename = `tradermind_trades_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, filename);
  },
};
