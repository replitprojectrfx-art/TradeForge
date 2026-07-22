import { db, Trade, defaultPostTradeReview } from '../db/database';
import { isWin, isLoss, isClosed } from '../lib/tradeHelpers';
import { strategyService } from './strategyService';
import { analysisService } from './analysisService';
import { tradeVersionService } from './tradeEventService';

const defaultReview = JSON.stringify({ didWell: '', didWrong: '', learned: '', wouldTakeAgain: null, validSetup: null });
const defaultPostTradeReviewStr = JSON.stringify(defaultPostTradeReview);

export const tradeService = {
  async getAllTrades() {
    return db.trades.orderBy('openedAt').reverse().toArray();
  },

  async getTradeById(id: string) {
    return db.trades.get(id);
  },

  async createTrade(data: Partial<Trade> = {}): Promise<Trade> {
    const id = crypto.randomUUID();
    const now = Date.now();
    const trade: Trade = {
      sessionId: null, strategyId: null, symbol: '', market: null,
      direction: 'long', entryPrice: 0, exitPrice: null, stopLoss: 0,
      takeProfit: null, positionSize: null, riskPercentage: null, riskAmount: null,
      rMultiple: null, result: 'open', profitLoss: null, fees: null, status: 'open',
      openedAt: now, closedAt: null, reasonForExit: null,
      emotions: '[]', emotionNotes: null, notes: null,
      screenshots: '[]', adherenceScore: null, adherenceRating: null,
      adherenceNotes: null, review: defaultReview, postTradeReview: defaultPostTradeReviewStr,
      tags: '[]', liveMonitoring: null, createdAt: now,
      // Prompt 23 — new fields
      plannedEntry: null, plannedSL: null, plannedTP: null, plannedRR: null,
      plannedRisk: null, plannedPositionSize: null,
      tradingSession: null, setupType: null, timezone: null,
      entryReason: null, lesson: null,
      slMoved: null, tpMoved: null, partialClose: null, addedToPosition: null,
      reducedPosition: null, manualExit: null, managementReason: null,
      mtfAnalysis: null,
      ...data, id,
    };
    await db.trades.add(trade);
    return trade;
  },

  async updateTrade(id: string, data: Partial<Trade>) {
    const existing = await db.trades.get(id);
    if (existing) {
      // ثبت نسخه اگر فیلدهای مهم تغییر کرده باشند
      try { await tradeVersionService.recordVersion(existing, data); } catch { /* non-critical */ }
    }
    await db.trades.update(id, data);
    return db.trades.get(id);
  },

  async deleteTrade(id: string) {
    await db.trades.delete(id);
  },

  async computeAdherenceScore(sessionId: string): Promise<number | null> {
    try {
      const session = await analysisService.getSessionById(sessionId);
      if (!session) return null;
      const stepResults = JSON.parse(session.stepResults || '{}');
      const phases = await strategyService.getPhasesByStrategyId(session.strategyId);
      let required = 0, answered = 0;
      for (const phase of phases) {
        const steps = await strategyService.getStepsByPhaseId(phase.id);
        for (const step of steps) {
          if (step.required) {
            required++;
            const res = stepResults[step.id];
            if (res && res.value !== null && res.value !== undefined && res.value !== '' && res.value !== false) answered++;
          }
        }
      }
      return required === 0 ? 100 : Math.round((answered / required) * 100);
    } catch { return null; }
  },

  async getStats() {
    const trades = await db.trades.toArray();
    const closed = trades.filter(isClosed);
    const wins = closed.filter(isWin);
    const withR = closed.filter(t => t.rMultiple != null);
    return {
      total: trades.length,
      winRate: closed.length > 0 ? (wins.length / closed.length) * 100 : 0,
      totalPnl: trades.reduce((acc, t) => acc + (t.profitLoss || 0) - (t.fees || 0), 0),
      avgRMultiple: withR.length > 0 ? withR.reduce((acc, t) => acc + (t.rMultiple || 0), 0) / withR.length : 0,
      closedCount: closed.length,
      openCount: trades.filter(t => t.status === 'open').length,
    };
  },

  async getTradesWithFilters(filters: {
    search?: string; result?: string; direction?: string; strategyId?: string;
    emotion?: string; adherenceRating?: string; dateFrom?: number; dateTo?: number;
  } = {}) {
    let trades = await db.trades.orderBy('openedAt').reverse().toArray();
    if (filters.search) { const s = filters.search.toLowerCase(); trades = trades.filter(t => t.symbol.toLowerCase().includes(s)); }
    if (filters.result && filters.result !== 'all') trades = trades.filter(t => t.result === filters.result);
    if (filters.direction && filters.direction !== 'all') trades = trades.filter(t => t.direction === filters.direction);
    if (filters.strategyId && filters.strategyId !== 'all') trades = trades.filter(t => t.strategyId === filters.strategyId);
    if (filters.emotion && filters.emotion !== 'all') {
      trades = trades.filter(t => { try { return (JSON.parse(t.emotions) as string[]).includes(filters.emotion!); } catch { return false; } });
    }
    if (filters.adherenceRating && filters.adherenceRating !== 'all') trades = trades.filter(t => t.adherenceRating === filters.adherenceRating);
    if (filters.dateFrom) trades = trades.filter(t => t.openedAt >= filters.dateFrom!);
    if (filters.dateTo) trades = trades.filter(t => t.openedAt <= filters.dateTo!);
    return trades;
  },

  /** دریافت معاملات یک روز مشخص بر اساس تاریخ YYYY-MM-DD */
  async getTradesByDate(dateStr: string): Promise<Trade[]> {
    const start = new Date(dateStr + 'T00:00:00').getTime();
    const end = new Date(dateStr + 'T23:59:59').getTime();
    return db.trades
      .where('openedAt')
      .between(start, end, true, true)
      .toArray();
  },
};
