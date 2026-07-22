import * as React from 'react';
import { useAppStore } from '../store/useAppStore';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme, fontSize, language } = useAppStore();

  // ── حالت نمایش (روشن / تاریک / سیستم)
  React.useEffect(() => {
    const root = window.document.documentElement;
    const applyTheme = (resolved: 'light' | 'dark') => {
      root.classList.remove('light', 'dark');
      root.classList.add(resolved);
    };
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mq.matches ? 'dark' : 'light');
      const handler = (e: MediaQueryListEvent) => applyTheme(e.matches ? 'dark' : 'light');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
    applyTheme(theme as 'light' | 'dark');
    return undefined;
  }, [theme]);

  // ── اندازه متن
  React.useEffect(() => {
    window.document.documentElement.setAttribute('data-font-size', fontSize ?? 'md');
  }, [fontSize]);

  // ── جهت‌نویسی و زبان (RTL/LTR)
  React.useEffect(() => {
    const root = window.document.documentElement;
    const isRtl = language === 'fa';
    root.setAttribute('dir', isRtl ? 'rtl' : 'ltr');
    root.setAttribute('lang', language);
  }, [language]);

  return <>{children}</>;
}
