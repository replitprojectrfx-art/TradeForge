import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─────────────────────────────────────────────
// انواع
// ─────────────────────────────────────────────
export type ThemeMode = 'light' | 'dark' | 'system';
export type FontSize = 'sm' | 'md' | 'lg';
export type Language = 'fa'; // در آینده: | 'en'

export interface AppSettings {
  // ظاهر
  theme: ThemeMode;
  fontSize: FontSize;
  language: Language;

  // Sidebar
  sidebarOpen: boolean;

  // نام برنامه
  appName: string;

  // تنظیمات تحلیل
  analysisAutosave: boolean;
  analysisShowNextStep: boolean;
  analysisPhaseSummary: boolean;
  analysisConfirmPhase: boolean;
  analysisProgressBar: boolean;

  // تنظیمات ژورنال
  journalAutosave: boolean;
  journalCustomTags: string[];
  journalCustomEmotions: string[];

  // داشبورد
  dashShowTrades: boolean;
  dashShowWinRate: boolean;
  dashShowPnl: boolean;
  dashShowAvgR: boolean;
  dashShowRecentTrades: boolean;
  dashShowLastJournal: boolean;
  dashShowAdherence: boolean;
}

interface AppActions {
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setTheme: (theme: ThemeMode) => void;
  setFontSize: (size: FontSize) => void;
  setLanguage: (lang: Language) => void;
  setAppName: (name: string) => void;
  // تحلیل
  setAnalysisAutosave: (v: boolean) => void;
  setAnalysisShowNextStep: (v: boolean) => void;
  setAnalysisPhaseSummary: (v: boolean) => void;
  setAnalysisConfirmPhase: (v: boolean) => void;
  setAnalysisProgressBar: (v: boolean) => void;
  // ژورنال
  setJournalAutosave: (v: boolean) => void;
  addJournalTag: (tag: string) => void;
  removeJournalTag: (tag: string) => void;
  addJournalEmotion: (emotion: string) => void;
  removeJournalEmotion: (emotion: string) => void;
  // داشبورد
  setDashShowTrades: (v: boolean) => void;
  setDashShowWinRate: (v: boolean) => void;
  setDashShowPnl: (v: boolean) => void;
  setDashShowAvgR: (v: boolean) => void;
  setDashShowRecentTrades: (v: boolean) => void;
  setDashShowLastJournal: (v: boolean) => void;
  setDashShowAdherence: (v: boolean) => void;
  // ریست
  resetToDefaults: () => void;
}

// ─────────────────────────────────────────────
// مقادیر پیش‌فرض
// ─────────────────────────────────────────────
const defaults: AppSettings = {
  theme: 'dark',
  fontSize: 'md',
  language: 'fa',
  sidebarOpen: false,
  appName: 'TraderMind',
  // تحلیل
  analysisAutosave: true,
  analysisShowNextStep: true,
  analysisPhaseSummary: true,
  analysisConfirmPhase: false,
  analysisProgressBar: true,
  // ژورنال
  journalAutosave: true,
  journalCustomTags: [],
  journalCustomEmotions: [],
  // داشبورد
  dashShowTrades: true,
  dashShowWinRate: true,
  dashShowPnl: true,
  dashShowAvgR: true,
  dashShowRecentTrades: true,
  dashShowLastJournal: true,
  dashShowAdherence: false,
};

// ─────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────
export const useAppStore = create<AppSettings & AppActions>()(
  persist(
    (set) => ({
      ...defaults,

      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setTheme: (theme) => set({ theme }),
      setFontSize: (fontSize) => set({ fontSize }),
      setLanguage: (language) => set({ language }),
      setAppName: (appName) => set({ appName }),

      setAnalysisAutosave: (v) => set({ analysisAutosave: v }),
      setAnalysisShowNextStep: (v) => set({ analysisShowNextStep: v }),
      setAnalysisPhaseSummary: (v) => set({ analysisPhaseSummary: v }),
      setAnalysisConfirmPhase: (v) => set({ analysisConfirmPhase: v }),
      setAnalysisProgressBar: (v) => set({ analysisProgressBar: v }),

      setJournalAutosave: (v) => set({ journalAutosave: v }),
      addJournalTag: (tag) =>
        set((s) => ({ journalCustomTags: [...new Set([...s.journalCustomTags, tag.trim()])] })),
      removeJournalTag: (tag) =>
        set((s) => ({ journalCustomTags: s.journalCustomTags.filter((t) => t !== tag) })),
      addJournalEmotion: (emotion) =>
        set((s) => ({ journalCustomEmotions: [...new Set([...s.journalCustomEmotions, emotion.trim()])] })),
      removeJournalEmotion: (emotion) =>
        set((s) => ({ journalCustomEmotions: s.journalCustomEmotions.filter((e) => e !== emotion) })),

      setDashShowTrades: (v) => set({ dashShowTrades: v }),
      setDashShowWinRate: (v) => set({ dashShowWinRate: v }),
      setDashShowPnl: (v) => set({ dashShowPnl: v }),
      setDashShowAvgR: (v) => set({ dashShowAvgR: v }),
      setDashShowRecentTrades: (v) => set({ dashShowRecentTrades: v }),
      setDashShowLastJournal: (v) => set({ dashShowLastJournal: v }),
      setDashShowAdherence: (v) => set({ dashShowAdherence: v }),

      resetToDefaults: () => set({ ...defaults, sidebarOpen: true }),
    }),
    {
      name: 'tradermind-app-storage',
      // ادغام هوشمند — مقادیر جدید با مقادیر پیش‌فرض ترکیب می‌شوند
      merge: (persisted: any, current) => ({
        ...current,
        ...persisted,
        // backward compat: اگر theme قدیمی بود، معتبر باشد
        theme: ['light', 'dark', 'system'].includes(persisted?.theme)
          ? persisted.theme
          : defaults.theme,
      }),
    }
  )
);
