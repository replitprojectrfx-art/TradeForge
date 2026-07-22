/**
 * Seed Data — فقط برای محیط Development
 * در Production هرگز اجرا نمی‌شود.
 */
import { strategyService } from './strategyService';
import { tradeService } from './tradeService';
import { journalService } from './journalService';
import { analysisService } from './analysisService';
import { db } from '../db/database';

const IS_DEV = import.meta.env.DEV;

/** روزهای گذشته به timestamp */
function daysAgo(n: number): number {
  return Date.now() - n * 24 * 60 * 60 * 1000;
}

/** تاریخ YYYY-MM-DD برای n روز پیش */
function dateStrAgo(n: number): string {
  return new Date(daysAgo(n)).toISOString().split('T')[0];
}

export async function seedInitialData() {
  // فقط در Dev و فقط اگر دیتابیس خالی باشد
  const existing = await strategyService.getAllStrategies();
  if (existing.length > 0) return;

  // ════════════════════════════
  // ۱. Strategy + Phases + Steps
  // ════════════════════════════
  const strategy = await strategyService.createStrategy({
    name: 'Scalping Multi-TF',
    description: 'تحلیل چند تایم‌فریم از ۴H تا ۱M برای ورود دقیق به معامله.',
    icon: null,
    colorTag: '#3b82f6',
    isActive: true,
  });

  const phasesData = [
    {
      name: 'تحلیل ۴H',
      description: 'بررسی ساختار کلی بازار و تعیین Bias.',
      steps: [
        { name: 'شناسایی مناطق عرضه و تقاضا', hint: 'مناطق کلیدی را روی چارت ۴H علامت بزن.', type: 'checkbox' as const, required: true },
        { name: 'وضعیت نقدینگی', hint: 'نقدینگی Buy-Side یا Sell-Side کجاست؟', type: 'select' as const, options: ['Buy-Side', 'Sell-Side', 'هر دو', 'نامشخص'] },
        { name: 'جهت کلی بازار', hint: 'Leg فعلی چیست؟', type: 'select' as const, options: ['صعودی', 'نزولی', 'رنج', 'نامشخص'], required: true },
        { name: 'یادداشت تحلیل ۴H', hint: 'رفتار قیمت را توضیح بده.', type: 'textarea' as const },
      ],
    },
    {
      name: 'تحلیل ۱۵M',
      description: 'ریز شدن روی ۱۵ دقیقه برای تأیید Bias.',
      steps: [
        { name: 'جهت ۱۵ دقیقه', hint: 'ساختار بازار در ۱۵M چیست؟', type: 'select' as const, options: ['صعودی', 'نزولی', 'رنج', 'نامشخص'], required: true },
        { name: 'تطابق با ۴H', hint: 'آیا ۱۵M با ۴H هماهنگ است؟', type: 'select' as const, options: ['هماهنگ', 'مخالف', 'خنثی'] },
        { name: 'موقعیت قیمت', hint: 'قیمت نسبت به مناطق کجاست؟', type: 'textarea' as const },
      ],
    },
    {
      name: 'ورود ۱M',
      description: 'اجرای دقیق ورود روی ۱ دقیقه.',
      steps: [
        { name: 'جهت ورود', hint: 'Long یا Short؟', type: 'select' as const, options: ['Long', 'Short'], required: true },
        { name: 'محرک ورود', hint: 'چه سیگنالی ورود را تأیید کرد؟', type: 'text' as const, required: true },
        { name: 'حد ضرر', hint: 'سطح Stop Loss را وارد کن.', type: 'number' as const, required: true },
        { name: 'حد سود', hint: 'سطح Take Profit را وارد کن.', type: 'number' as const },
        { name: 'درصد ریسک', hint: 'چند درصد از حساب ریسک می‌کنی؟', type: 'number' as const, required: true },
        { name: 'تصمیم نهایی', hint: 'آیا شرایط کامل است؟', type: 'select' as const, options: ['بله — ورود می‌کنم', 'خیر — رد می‌کنم', 'منتظر می‌مانم'], required: true },
      ],
    },
  ];

  const phaseObjs = [];
  for (let pi = 0; pi < phasesData.length; pi++) {
    const pd = phasesData[pi];
    const phase = await strategyService.createPhase({
      strategyId: strategy.id,
      name: pd.name,
      description: pd.description,
      order: pi,
    });
    phaseObjs.push(phase);
    for (let si = 0; si < pd.steps.length; si++) {
      const sd = pd.steps[si];
      await strategyService.createStep({
        phaseId: phase.id,
        name: sd.name,
        description: '',
        type: sd.type,
        required: (sd as any).required ?? (sd.type === 'checkbox'),
        order: si,
        options: JSON.stringify((sd as any).options || []),
        hint: sd.hint,
      });
    }
  }

  // ════════════════════════════
  // ۲. Analysis Sessions نمونه
  // ════════════════════════════
  if (!IS_DEV) return; // trades و journals فقط در dev

  const sessionData = [
    { daysAgoN: 5, status: 'completed' as const },
    { daysAgoN: 3, status: 'completed' as const },
    { daysAgoN: 1, status: 'in-progress' as const },
  ];

  const sessions = [];
  for (const sd of sessionData) {
    const sess = await analysisService.createSession(strategy.id);
    const stepResults: Record<string, { value: unknown; answeredAt: number }> = {};
    // پر کردن step results نمونه
    if (sd.status === 'completed') {
      stepResults['sample'] = { value: 'بله', answeredAt: daysAgo(sd.daysAgoN) };
    }
    await analysisService.updateSession(sess.id, {
      status: sd.status,
      startedAt: daysAgo(sd.daysAgoN),
      completedAt: sd.status === 'completed' ? daysAgo(sd.daysAgoN) + 3600_000 : null,
      currentPhaseId: phaseObjs[sd.status === 'in-progress' ? 1 : 2]?.id ?? null,
      stepResults: JSON.stringify(stepResults),
      finalDecision: sd.status === 'completed' ? 'Long — ورود کردم' : null,
    });
    sessions.push(sess);
  }

  // ════════════════════════════
  // ۳. Trades نمونه
  // ════════════════════════════
  // داده‌های معاملاتی غنی با تگ‌ها، جلسات، و رژیم بازار
  const tradesSeed = [
    // XAUUSD — معاملات متنوع با رفتارهای مختلف
    { symbol: 'XAUUSD', direction: 'long' as const,  result: 'win' as const,       profitLoss: 320,  rMultiple: 3.2, dAgo: 45, hour: 9,  tags: ['impulse-bullish','range','61.8','expansion'], didWell: 'منتظر تکمیل ریتریسمنت ماندم', didWrong: '' },
    { symbol: 'XAUUSD', direction: 'short' as const, result: 'win' as const,       profitLoss: 450,  rMultiple: 4.5, dAgo: 38, hour: 10, tags: ['impulse-bearish','strong-trend','38.2','continuation'], didWell: 'ورود دقیق بعد از ایمپالس نزولی', didWrong: '' },
    { symbol: 'XAUUSD', direction: 'long' as const,  result: 'win' as const,       profitLoss: 210,  rMultiple: 2.1, dAgo: 30, hour: 8,  tags: ['range','61.8','london','reversal'], didWell: 'رنج را درست تشخیص دادم', didWrong: '' },
    { symbol: 'XAUUSD', direction: 'long' as const,  result: 'loss' as const,      profitLoss: -120, rMultiple: -1,  dAgo: 22, hour: 14, tags: ['impulse-bullish','range','high-vol','early-entry'], didWell: '', didWrong: 'ورود زود بدون تأیید — قبل از تکمیل رنج وارد شدم' },
    { symbol: 'XAUUSD', direction: 'short' as const, result: 'win' as const,       profitLoss: 380,  rMultiple: 3.8, dAgo: 15, hour: 9,  tags: ['expansion','impulse-bearish','78.6','strong-trend'], didWell: 'صبر برای بستن کندل تأیید', didWrong: '' },
    { symbol: 'XAUUSD', direction: 'long' as const,  result: 'win' as const,       profitLoss: 150,  rMultiple: 1.5, dAgo: 8,  hour: 7,  tags: ['range','38.2','asian','compression'], didWell: 'شناسایی محدوده رنج آسیا', didWrong: '' },
    { symbol: 'XAUUSD', direction: 'long' as const,  result: 'loss' as const,      profitLoss: -90,  rMultiple: -1,  dAgo: 3,  hour: 15, tags: ['overlap','reversal','over-leveraged'], didWell: '', didWrong: 'حجم بیش از حد با وضعیت بازار نامطمئن' },
    // EURUSD — رفتار متفاوت از XAUUSD
    { symbol: 'EURUSD', direction: 'short' as const, result: 'loss' as const,      profitLoss: -100, rMultiple: -1,  dAgo: 40, hour: 14, tags: ['range','61.8','weak-trend','newyork'], didWell: '', didWrong: 'ترند ضعیف بود و نباید وارد می‌شدم' },
    { symbol: 'EURUSD', direction: 'long' as const,  result: 'breakeven' as const, profitLoss: 0,    rMultiple: 0,   dAgo: 33, hour: 8,  tags: ['london','range','50','compression'], didWell: 'حد ضرر را به سربه‌سر منتقل کردم', didWrong: '' },
    { symbol: 'EURUSD', direction: 'short' as const, result: 'win' as const,       profitLoss: 140,  rMultiple: 1.4, dAgo: 25, hour: 9,  tags: ['london','strong-trend','38.2','continuation'], didWell: 'ترند لندن را درست دنبال کردم', didWrong: '' },
    { symbol: 'EURUSD', direction: 'long' as const,  result: 'loss' as const,      profitLoss: -80,  rMultiple: -1,  dAgo: 17, hour: 13, tags: ['overlap','reversal','impulse-bullish','counter-trend'], didWell: '', didWrong: 'خلاف ترند کلی وارد شدم — اشتباه بزرگ' },
    { symbol: 'EURUSD', direction: 'short' as const, result: 'win' as const,       profitLoss: 170,  rMultiple: 1.7, dAgo: 10, hour: 10, tags: ['london','50','expansion','continuation'], didWell: 'فیبوناچی ۵۰ درصد محکم بود', didWrong: '' },
    { symbol: 'EURUSD', direction: 'long' as const,  result: 'loss' as const,      profitLoss: -60,  rMultiple: -1,  dAgo: 4,  hour: 8,  tags: ['london','range','low-vol','revenge-trade'], didWell: '', didWrong: 'معامله انتقامی بعد از ضرر قبلی — نباید وارد می‌شدم' },
    // GBPUSD — نمونه سوم
    { symbol: 'GBPUSD', direction: 'long' as const,  result: 'loss' as const,      profitLoss: -90,  rMultiple: -1,  dAgo: 35, hour: 9,  tags: ['london','impulse-bullish','range','78.6'], didWell: '', didWrong: 'ریتریسمنت خیلی عمیق بود، توقع کم‌تری داشتم' },
    { symbol: 'GBPUSD', direction: 'short' as const, result: 'win' as const,       profitLoss: 290,  rMultiple: 2.9, dAgo: 20, hour: 14, tags: ['overlap','strong-trend','38.2','impulse-bearish'], didWell: 'همپوشانی لندن/نیویورک ترند قوی بود', didWrong: '' },
    { symbol: 'GBPUSD', direction: 'short' as const, result: 'win' as const,       profitLoss: 220,  rMultiple: 2.2, dAgo: 7,  hour: 10, tags: ['london','expansion','61.8','continuation'], didWell: 'ورود صبورانه بعد از ریتریسمنت ۶۱.۸', didWrong: '' },
    // USDJPY
    { symbol: 'USDJPY', direction: 'short' as const, result: 'win' as const,       profitLoss: 180,  rMultiple: 1.8, dAgo: 28, hour: 2,  tags: ['asian','range','50','compression'], didWell: 'رنج آسیا را خوب شناختم', didWrong: '' },
    { symbol: 'USDJPY', direction: 'long' as const,  result: 'loss' as const,      profitLoss: -70,  rMultiple: -1,  dAgo: 12, hour: 3,  tags: ['asian','low-vol','impulse-bullish','early-entry'], didWell: '', didWrong: 'بازار آسیا نوسان کم داشت — نباید وارد می‌شدم' },
    { symbol: 'USDJPY', direction: 'short' as const, result: 'win' as const,       profitLoss: 250,  rMultiple: 2.5, dAgo: 5,  hour: 16, tags: ['newyork','expansion','strong-trend','61.8'], didWell: 'نیویورک ترند خوبی داشت', didWrong: '' },
  ];

  const REVIEW = (didWell: string, didWrong: string) =>
    JSON.stringify({ didWell, didWrong, learned: '', wouldTakeAgain: null, validSetup: null });

  const adherenceByResult = { win: 'fully', loss: 'partially', breakeven: 'mostly' } as const;

  for (let i = 0; i < tradesSeed.length; i++) {
    const ts = tradesSeed[i];
    // تنظیم ساعت UTC برای شناسایی جلسه
    const baseTime = daysAgo(ts.dAgo);
    const openTime = new Date(baseTime);
    openTime.setUTCHours(ts.hour, 0, 0, 0);
    const openTs = openTime.getTime();

    const resultKey = ts.result === 'win' ? 'win' : ts.result === 'loss' ? 'loss' : 'breakeven';
    const adhR = adherenceByResult[resultKey];
    const adhScore = adhR === 'fully' ? 90 : adhR === 'mostly' ? 70 : 45;

    await db.trades.add({
      id: crypto.randomUUID(),
      strategyId: strategy.id,
      sessionId: sessions[i % sessions.length]?.id ?? null,
      symbol: ts.symbol,
      market: ts.symbol.includes('XAU') || ts.symbol.includes('XAG') ? 'commodity' : 'forex',
      direction: ts.direction,
      entryPrice: 2000 + i * 5,
      exitPrice: 2000 + i * 5 + (ts.profitLoss > 0 ? 15 : -10),
      stopLoss: 2000 + i * 5 - 10,
      takeProfit: 2000 + i * 5 + 30,
      positionSize: 0.1,
      riskAmount: 100,
      fees: null,
      status: 'closed',
      result: ts.result,
      profitLoss: ts.profitLoss,
      rMultiple: ts.rMultiple,
      riskPercentage: 1,
      adherenceScore: adhScore,
      adherenceRating: adhR,
      adherenceNotes: null,
      emotions: ts.result === 'win' ? '["اطمینان","آرامش"]' : '["استرس"]',
      emotionNotes: null,
      reasonForExit: ts.result === 'win' ? 'رسیدن به هدف' : 'فعال شدن حد ضرر',
      notes: `معامله نمونه ${i + 1}`,
      screenshots: '[]',
      review: REVIEW(ts.didWell, ts.didWrong),
      postTradeReview: JSON.stringify({ completedAt: 0, expectationText: '', actualBehaviorText: '', directionalAccuracy: null, timingAccuracy: null, entryAccuracy: null, exitAccuracy: null, retracementAccuracy: null, confirmationAccuracy: null, htfAnalysisCorrect: null, m15StructureCorrect: null, m5SetupCorrect: null, m1EntryValid: null, analysisNotes: '', entryFollowedPlan: null, entryTiming: null, enteredWithConfirmation: null, executionNotes: '', slRespected: null, slMoved: null, riskIncreased: null, closedEarly: null, heldTooLong: null, riskNotes: '', marketAsExpected: null, unexpectedEvent: null, priceEnteredRange: null, deeperRetracement: null, marketBehaviorNotes: '', tradeQualityScore: null, analysisQualityScore: null, executionQualityScore: null, riskMgmtQualityScore: null, lossCategory: null, luckyWin: null, behaviorFlags: [], behaviorNotes: '', userReflection: '', aiAnalysis: null, userCorrections: [] }),
      tags: JSON.stringify(ts.tags),
      liveMonitoring: null,
      openedAt: openTs,
      closedAt: openTs + (1 + (i % 4)) * 3_600_000,
      createdAt: openTs,
      plannedEntry: null, plannedSL: null, plannedTP: null, plannedRR: null,
      plannedRisk: null, plannedPositionSize: null,
      tradingSession: null, setupType: null, timezone: null,
      entryReason: null, lesson: null,
      slMoved: null, tpMoved: null, partialClose: null, addedToPosition: null,
      reducedPosition: null, manualExit: null, managementReason: null,
      mtfAnalysis: null,
    });
  }

  // ════════════════════════════
  // ۴. Daily Journals نمونه
  // ════════════════════════════
  // mood: 1-5 | energy/focus/stress: 1-10
  const journalSeeds = [
    { dAgo: 6, mood: 4, energy: 7, focus: 8, stress: 2, notes: 'روز خوبی بود. بازار واضح بود.' },
    { dAgo: 5, mood: 3, energy: 5, focus: 6, stress: 5, notes: 'کمی خسته بودم. ترید نکردم.' },
    { dAgo: 4, mood: 5, energy: 8, focus: 9, stress: 1, notes: 'بهترین حالت ذهنی! همه شرایط رعایت شد.' },
    { dAgo: 3, mood: 2, energy: 4, focus: 5, stress: 7, notes: 'روز پر استرس. یک معامله بد گرفتم.' },
    { dAgo: 2, mood: 4, energy: 8, focus: 7, stress: 3, notes: 'مثبت بودم. نتایج خوب.' },
    { dAgo: 1, mood: 4, energy: 6, focus: 7, stress: 4, notes: 'روز نسبتاً خوب.' },
    { dAgo: 0, mood: 4, energy: 7, focus: 8, stress: 2, notes: 'امروز آرام هستم.' },
  ];

  for (const js of journalSeeds) {
    const dateStr = dateStrAgo(js.dAgo);
    const existing = await journalService.getJournalByDate(dateStr);
    if (!existing) {
      await journalService.saveJournal({
        date: dateStr,
        mood: js.mood,
        energyLevel: js.energy,
        focusLevel: js.focus,
        stressLevel: js.stress,
        notes: js.notes,
        emotions: '[]',
        importantEventsToday: null,
        importantEventsYesterday: null,
        preTradingState: JSON.stringify({ mood: js.mood, energy: js.energy, focus: js.focus, stress: js.stress, readiness: 3, notes: '' }),
        endOfDayReview: JSON.stringify({ didWell: '', didWrong: '', learned: '', followedRules: null }),
        tags: '[]',
      });
    }
  }
}
