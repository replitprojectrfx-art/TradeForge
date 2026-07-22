import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { tradeService } from "../services/tradeService";
import { analysisService } from "../services/analysisService";
import { strategyService } from "../services/strategyService";
import { db, Trade, Strategy, AnalysisSession } from "../db/database";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { ArrowLeft, Save, Eye, Plus, X, Image as ImageIcon, Zap, BookOpen, ChevronDown, ChevronUp, CheckSquare, Square } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "../components/ui/progress";
import { format } from "date-fns";
import PreTradeInsightPanel from "../components/PreTradeInsightPanel";
import ScreenshotManager from "../components/ScreenshotManager";
import { TradeScreenshot } from "../types/screenshot";

const MARKETS = ['Forex', 'Crypto', 'Indices', 'Stocks', 'Commodities', 'Other'];
const EMOTIONS = [
  { id: 'Calm', color: 'bg-sky-500' },
  { id: 'Confident', color: 'bg-emerald-500' },
  { id: 'Uncertain', color: 'bg-amber-500' },
  { id: 'Fearful', color: 'bg-orange-500' },
  { id: 'Anxious', color: 'bg-orange-500' },
  { id: 'Excited', color: 'bg-violet-500' },
  { id: 'Frustrated', color: 'bg-red-500' },
  { id: 'FOMO', color: 'bg-rose-500' },
  { id: 'Revenge Trading', color: 'bg-red-600' },
  { id: 'Overconfident', color: 'bg-yellow-500' },
  { id: 'Tired', color: 'bg-slate-500' },
  { id: 'Distracted', color: 'bg-slate-500' }
];

export default function NewTrade() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const sessionId = searchParams.get('sessionId');
  const editId = searchParams.get('editId');
  const idFromUrl = searchParams.get('id');

  const [trade, setTrade] = useState<Trade | null>(null);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [session, setSession] = useState<AnalysisSession | null>(null);
  const [linkedStrategy, setLinkedStrategy] = useState<Strategy | null>(null);
  
  const [isSaving, setIsSaving] = useState(false);
  const [showSavedIndicator, setShowSavedIndicator] = useState(false);
  const [allTrades, setAllTrades] = useState<Trade[]>([]);
  const [isQuickMode, setIsQuickMode] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  useEffect(() => {
    db.trades.toArray().then(setAllTrades);
  }, []);

  // بررسی معامله تکراری
  useEffect(() => {
    if (!trade || !trade.symbol || !trade.entryPrice || !initialized.current) return;
    const check = async () => {
      const existing = await db.trades
        .where('symbol').equalsIgnoreCase(trade.symbol).toArray();
      const dup = existing.find(t =>
        t.id !== trade.id &&
        t.direction === trade.direction &&
        Math.abs(t.entryPrice - trade.entryPrice) < trade.entryPrice * 0.001 &&
        Math.abs(t.openedAt - trade.openedAt) < 60_000
      );
      if (dup) {
        setDuplicateWarning(`احتمال تکرار: معامله مشابهی در ${new Date(dup.openedAt).toLocaleDateString('fa-IR')} ثبت شده است.`);
      } else {
        setDuplicateWarning(null);
      }
    };
    const timer = setTimeout(check, 1000);
    return () => clearTimeout(timer);
  }, [trade?.symbol, trade?.direction, trade?.entryPrice, trade?.openedAt]);

  const tradeIdRef = useRef<string | null>(editId || idFromUrl || null);
  const lastSavedRef = useRef<Trade | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    const init = async () => {
      if (initialized.current) return;
      initialized.current = true;

      const strats = await strategyService.getAllStrategies();
      setStrategies(strats);

      let currentTrade: Trade | null = null;

      if (tradeIdRef.current) {
        const existing = await tradeService.getTradeById(tradeIdRef.current);
        if (existing) {
          currentTrade = existing;
        }
      } 
      
      if (!currentTrade) {
        currentTrade = await tradeService.createTrade({
          sessionId: sessionId || null
        });
        tradeIdRef.current = currentTrade.id;
        window.history.replaceState(null, '', window.location.pathname + '?id=' + currentTrade.id + (sessionId ? `&sessionId=${sessionId}` : ''));
      }

      setTrade(currentTrade);
      lastSavedRef.current = currentTrade;

      const targetSessionId = currentTrade.sessionId || sessionId;
      if (targetSessionId) {
        const sess = await analysisService.getSessionById(targetSessionId);
        if (sess) {
          setSession(sess);
          const strat = await strategyService.getStrategyById(sess.strategyId);
          if (strat) setLinkedStrategy(strat);

          if (currentTrade.adherenceScore === null) {
            const score = await tradeService.computeAdherenceScore(sess.id);
            handleChange('adherenceScore', score);
          }
        }
      }
    };
    init();
  }, [editId, idFromUrl, sessionId]);

  const handleChange = useCallback((field: keyof Trade, value: any) => {
    setTrade(prev => {
      if (!prev) return prev;
      return { ...prev, [field]: value };
    });
  }, []);

  const saveTrade = useCallback(async (dataToSave: Trade) => {
    if (!dataToSave.id) return;
    setIsSaving(true);
    await tradeService.updateTrade(dataToSave.id, dataToSave);
    lastSavedRef.current = dataToSave;
    setIsSaving(false);
    setShowSavedIndicator(true);
    setTimeout(() => setShowSavedIndicator(false), 2000);
  }, []);

  useEffect(() => {
    if (!trade || !initialized.current) return;
    const timer = setTimeout(() => {
      if (JSON.stringify(trade) !== JSON.stringify(lastSavedRef.current)) {
        saveTrade(trade);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [trade, saveTrade]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (trade && JSON.stringify(trade) !== JSON.stringify(lastSavedRef.current)) {
        tradeService.updateTrade(trade.id, trade);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [trade]);

  const handleDateChange = (field: 'openedAt' | 'closedAt', dateString: string) => {
    const timestamp = new Date(dateString).getTime();
    handleChange(field, timestamp);
  };

  const formatDateForInput = (timestamp: number | null) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
  };

  const computeRMultiple = () => {
    if (!trade || trade.exitPrice === null || trade.exitPrice === undefined) return;
    const diff = Math.abs(trade.entryPrice - trade.stopLoss);
    if (diff === 0) return;

    let r = 0;
    if (trade.direction === 'long') {
      r = (trade.exitPrice - trade.entryPrice) / diff;
    } else {
      r = (trade.entryPrice - trade.exitPrice) / diff;
    }
    return r.toFixed(2);
  };

  const toggleEmotion = (emotionId: string) => {
    if (!trade) return;
    const currentEmotions = JSON.parse(trade.emotions || '[]') as string[];
    let updated;
    if (currentEmotions.includes(emotionId)) {
      updated = currentEmotions.filter(e => e !== emotionId);
    } else {
      updated = [...currentEmotions, emotionId];
    }
    handleChange('emotions', JSON.stringify(updated));
  };

  const currentEmotions = trade ? (JSON.parse(trade.emotions || '[]') as string[]) : [];
  const review = trade ? JSON.parse(trade.review || '{}') : {};
  const tags = trade ? JSON.parse(trade.tags || '[]') as string[] : [];
  const computedR = computeRMultiple();

  if (!trade) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Initializing trade...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 animate-in fade-in duration-500">
      <div className="flex items-center justify-between border-b pb-4 sticky top-0 bg-background/80 backdrop-blur z-10 pt-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation('/journal/trades')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{editId ? 'Edit Trade' : 'Log Trade'}</h1>
            <div className="flex items-center gap-2 text-sm">
              <span className={`text-muted-foreground transition-opacity ${showSavedIndicator ? 'opacity-100' : 'opacity-0'}`}>
                Saved
              </span>
              {isSaving && <span className="text-muted-foreground animate-pulse">Saving...</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Quick/Full toggle */}
          <div className="flex rounded-lg border overflow-hidden">
            <Button
              variant={isQuickMode ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none gap-1.5 h-8 px-3"
              onClick={() => setIsQuickMode(true)}
            >
              <Zap className="w-3.5 h-3.5" /> سریع
            </Button>
            <Button
              variant={!isQuickMode ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none gap-1.5 h-8 px-3"
              onClick={() => setIsQuickMode(false)}
            >
              <BookOpen className="w-3.5 h-3.5" /> کامل
            </Button>
          </div>
          <Button variant="outline" onClick={() => setLocation('/journal/trades')}>Cancel</Button>
          <Button onClick={() => setLocation(`/journal/trades/${trade.id}`)}>
            <Eye className="w-4 h-4 mr-2" /> Save & View
          </Button>
        </div>
      </div>

      {/* هشدار تکرار */}
      {duplicateWarning && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-sm text-amber-600 dark:text-amber-400 flex items-start gap-2">
          <span className="shrink-0">⚠️</span>
          <span>{duplicateWarning}</span>
          <button onClick={() => setDuplicateWarning(null)} className="mr-auto shrink-0 hover:opacity-70">✕</button>
        </div>
      )}

      <div className="space-y-12">
        {/* SECTION 1: Trade Info */}
        <section className="space-y-6">
          <h2 className="text-lg font-semibold border-b pb-2">1. Trade Info</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label>Symbol</Label>
              <Input 
                placeholder="BTCUSDT" 
                value={trade.symbol} 
                onChange={e => handleChange('symbol', e.target.value.toUpperCase())} 
                className="text-lg font-bold"
              />
            </div>

            {/* پانل بینش پیش از معامله — بعد از ورود نماد ظاهر می‌شود */}
            {trade.symbol && trade.symbol.length >= 2 && (
              <div className="lg:col-span-3">
                <PreTradeInsightPanel
                  symbol={trade.symbol}
                  tags={tags}
                  allTrades={allTrades}
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label>Market</Label>
              <Select value={trade.market || ''} onValueChange={v => handleChange('market', v)}>
                <SelectTrigger><SelectValue placeholder="Select Market" /></SelectTrigger>
                <SelectContent>
                  {MARKETS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 lg:col-span-3">
              <Label>Direction</Label>
              <div className="flex gap-2">
                <Button 
                  variant={trade.direction === 'long' ? 'default' : 'outline'}
                  onClick={() => handleChange('direction', 'long')}
                  className={`flex-1 ${trade.direction === 'long' ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/50 hover:bg-emerald-500/30' : ''}`}
                >
                  LONG
                </Button>
                <Button 
                  variant={trade.direction === 'short' ? 'default' : 'outline'}
                  onClick={() => handleChange('direction', 'short')}
                  className={`flex-1 ${trade.direction === 'short' ? 'bg-rose-500/20 text-rose-500 border-rose-500/50 hover:bg-rose-500/30' : ''}`}
                >
                  SHORT
                </Button>
              </div>
            </div>

            <div className="space-y-2 lg:col-span-3">
              <Label>Status</Label>
              <div className="flex gap-2">
                {['open', 'closed', 'cancelled'].map(status => (
                  <Button 
                    key={status}
                    variant={trade.status === status ? 'default' : 'outline'}
                    onClick={() => handleChange('status', status)}
                    className="flex-1 capitalize"
                  >
                    {status}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2 lg:col-span-3">
              <Label>Strategy</Label>
              <Select value={trade.strategyId || 'none'} onValueChange={v => handleChange('strategyId', v === 'none' ? null : v)}>
                <SelectTrigger><SelectValue placeholder="Select Strategy" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Strategy</SelectItem>
                  {strategies.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {/* ── سشن + ستاپ (بخشی از Section 1) ── */}
        {!isQuickMode && (
          <section className="space-y-6">
            <h2 className="text-lg font-semibold border-b pb-2">۱ب. سشن معاملاتی و ستاپ</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>سشن معاملاتی</Label>
                <Select value={(trade as any).tradingSession || ''} onValueChange={v => handleChange('tradingSession' as any, v || null)}>
                  <SelectTrigger><SelectValue placeholder="انتخاب کنید…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="london">لندن</SelectItem>
                    <SelectItem value="new-york">نیویورک</SelectItem>
                    <SelectItem value="asia">آسیا</SelectItem>
                    <SelectItem value="overlap">اوورلپ</SelectItem>
                    <SelectItem value="other">سایر</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>نوع ستاپ</Label>
                <Select value={(trade as any).setupType || ''} onValueChange={v => handleChange('setupType' as any, v || null)}>
                  <SelectTrigger><SelectValue placeholder="انتخاب کنید…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="break-and-retest">Break and Retest</SelectItem>
                    <SelectItem value="fvg">FVG (Fair Value Gap)</SelectItem>
                    <SelectItem value="liquidity-grab">Liquidity Grab</SelectItem>
                    <SelectItem value="order-block">Order Block</SelectItem>
                    <SelectItem value="trend-continuation">Trend Continuation</SelectItem>
                    <SelectItem value="reversal">Reversal</SelectItem>
                    <SelectItem value="support-resistance">حمایت/مقاومت</SelectItem>
                    <SelectItem value="other">سایر</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>
        )}

        {/* SECTION 2: Entry Details */}
        <section className="space-y-6">
          <h2 className="text-lg font-semibold border-b pb-2">2. Entry Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <Label>Opened At</Label>
              <Input 
                type="datetime-local" 
                value={formatDateForInput(trade.openedAt)}
                onChange={e => handleDateChange('openedAt', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Entry Price</Label>
              <Input type="text" inputMode="decimal" step="any" value={trade.entryPrice || ''} onChange={e => handleChange('entryPrice', parseFloat(e.target.value) || 0)} />
            </div>
            <div className="space-y-2">
              <Label>Stop Loss</Label>
              <Input type="text" inputMode="decimal" step="any" value={trade.stopLoss || ''} onChange={e => handleChange('stopLoss', parseFloat(e.target.value) || 0)} />
            </div>
            <div className="space-y-2">
              <Label>Take Profit</Label>
              <Input type="text" inputMode="decimal" step="any" value={trade.takeProfit || ''} onChange={e => handleChange('takeProfit', parseFloat(e.target.value) || null)} />
            </div>
          </div>
        </section>

        {/* ── برنامه معامله (Planned Trade) ── */}
        {!isQuickMode && (
          <section className="space-y-6">
            <h2 className="text-lg font-semibold border-b pb-2">۲ب. برنامه معامله (Planned)</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { key: 'plannedEntry', label: 'ورود برنامه‌ریزی‌شده' },
                { key: 'plannedSL', label: 'حد ضرر برنامه‌ریزی‌شده' },
                { key: 'plannedTP', label: 'حد سود برنامه‌ریزی‌شده' },
                { key: 'plannedRR', label: 'R:R برنامه‌ریزی‌شده' },
                { key: 'plannedRisk', label: 'ریسک برنامه‌ریزی‌شده (%)' },
                { key: 'plannedPositionSize', label: 'حجم برنامه‌ریزی‌شده' },
              ].map(f => (
                <div key={f.key} className="space-y-2">
                  <Label>{f.label}</Label>
                  <Input
                    type="text" inputMode="decimal"
                    value={(trade as any)[f.key] || ''}
                    onChange={e => handleChange(f.key as any, parseFloat(e.target.value) || null)}
                    placeholder="—"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* SECTION 3: Position Sizing */}
        <section className="space-y-6">
          <h2 className="text-lg font-semibold border-b pb-2">3. Position Sizing</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label>Position Size</Label>
              <Input type="text" inputMode="decimal" step="any" value={trade.positionSize || ''} onChange={e => handleChange('positionSize', parseFloat(e.target.value) || null)} />
            </div>
            <div className="space-y-2">
              <Label>Risk %</Label>
              <Input type="text" inputMode="decimal" step="any" value={trade.riskPercentage || ''} onChange={e => handleChange('riskPercentage', parseFloat(e.target.value) || null)} />
            </div>
            <div className="space-y-2">
              <Label>Risk Amount</Label>
              <Input type="text" inputMode="decimal" step="any" value={trade.riskAmount || ''} onChange={e => handleChange('riskAmount', parseFloat(e.target.value) || null)} />
            </div>
          </div>
        </section>

        {/* ── دلیل ورود ── */}
        {!isQuickMode && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold border-b pb-2">۳ب. دلیل ورود</h2>
            <div className="space-y-2">
              <Label>دلیل ورود به معامله</Label>
              <Textarea
                placeholder="چرا وارد این معامله شدید؟ چه چیزی را در چارت دیدید؟ ستاپ چه بود؟"
                value={(trade as any).entryReason || ''}
                onChange={e => handleChange('entryReason' as any, e.target.value || null)}
                className="min-h-[100px]"
              />
            </div>
          </section>
        )}

        {/* SECTION 4: Exit Details */}
        {trade.status === 'closed' && (
          <section className="space-y-6 animate-in slide-in-from-bottom-4">
            <h2 className="text-lg font-semibold border-b pb-2">4. Exit Details</h2>
            
            <div className="space-y-2">
              <Label>Result</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { v: 'win', l: 'Win', c: 'bg-emerald-500/20 text-emerald-500 border-emerald-500/50' },
                  { v: 'loss', l: 'Loss', c: 'bg-rose-500/20 text-rose-500 border-rose-500/50' },
                  { v: 'breakeven', l: 'Break Even', c: 'bg-slate-500/20 text-slate-500 border-slate-500/50' },
                  { v: 'partial-win', l: 'Partial Win', c: 'bg-teal-500/20 text-teal-500 border-teal-500/50' },
                  { v: 'partial-loss', l: 'Partial Loss', c: 'bg-amber-500/20 text-amber-500 border-amber-500/50' }
                ].map(res => (
                  <Button
                    key={res.v}
                    variant={trade.result === res.v ? 'default' : 'outline'}
                    onClick={() => handleChange('result', res.v)}
                    className={trade.result === res.v ? res.c : ''}
                  >
                    {res.l}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-2">
                <Label>Closed At</Label>
                <Input 
                  type="datetime-local" 
                  value={formatDateForInput(trade.closedAt)}
                  onChange={e => handleDateChange('closedAt', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Exit Price</Label>
                <Input type="text" inputMode="decimal" step="any" value={trade.exitPrice || ''} onChange={e => handleChange('exitPrice', parseFloat(e.target.value) || null)} />
              </div>
              <div className="space-y-2">
                <Label>P&L</Label>
                <Input type="text" inputMode="decimal" step="any" value={trade.profitLoss || ''} onChange={e => handleChange('profitLoss', parseFloat(e.target.value) || null)} />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>R Multiple</Label>
                  {computedR && <span className="text-xs text-muted-foreground">Auto: {computedR}R</span>}
                </div>
                <Input type="text" inputMode="decimal" step="any" value={trade.rMultiple || ''} onChange={e => handleChange('rMultiple', parseFloat(e.target.value) || null)} />
              </div>
              <div className="space-y-2">
                <Label>Fees</Label>
                <Input type="text" inputMode="decimal" step="any" value={trade.fees || ''} onChange={e => handleChange('fees', parseFloat(e.target.value) || null)} />
              </div>
              <div className="space-y-2 lg:col-span-3">
                <Label>Reason for Exit</Label>
                <Input value={trade.reasonForExit || ''} onChange={e => handleChange('reasonForExit', e.target.value)} placeholder="Hit target, trailed stop, etc." />
              </div>
            </div>
          </section>
        )}

        {/* ── مدیریت معامله ── */}
        {!isQuickMode && trade.status === 'closed' && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold border-b pb-2">۴ب. مدیریت معامله</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { key: 'slMoved',         label: 'جابجایی حد ضرر' },
                { key: 'tpMoved',         label: 'جابجایی حد سود' },
                { key: 'partialClose',    label: 'بستن بخشی از پوزیشن' },
                { key: 'addedToPosition', label: 'افزودن به پوزیشن' },
                { key: 'reducedPosition', label: 'کاهش پوزیشن' },
                { key: 'manualExit',      label: 'خروج دستی' },
              ].map(item => {
                const val = (trade as any)[item.key];
                return (
                  <button key={item.key}
                    onClick={() => handleChange(item.key as any, val === true ? false : val === false ? null : true)}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm text-right transition-colors ${
                      val === true ? 'border-primary bg-primary/10 text-primary' :
                      val === false ? 'border-muted-foreground/30 text-muted-foreground/50' :
                      'border-border hover:border-primary/40'
                    }`}>
                    {val === true ? <CheckSquare className="w-4 h-4 shrink-0" /> :
                     val === false ? <Square className="w-4 h-4 shrink-0 opacity-40" /> :
                     <Square className="w-4 h-4 shrink-0" />}
                    {item.label}
                  </button>
                );
              })}
            </div>
            <div className="space-y-2">
              <Label>توضیح تصمیمات مدیریت</Label>
              <Textarea
                placeholder="چرا حد ضرر را جابجا کردید؟ دلیل خروج زودهنگام چه بود؟"
                value={(trade as any).managementReason || ''}
                onChange={e => handleChange('managementReason' as any, e.target.value || null)}
                className="min-h-[80px]"
              />
            </div>
          </section>
        )}

        {/* SECTION 5: Strategy Adherence */}
        {(trade.sessionId || sessionId) && (
          <section className="space-y-6">
            <h2 className="text-lg font-semibold border-b pb-2">5. Strategy Adherence</h2>
            
            <Card className="bg-muted/30">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Linked Session</div>
                    <div className="font-semibold">{linkedStrategy?.name || 'Unknown Strategy'}</div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setLocation(`/analysis/${trade.sessionId || sessionId}`)}>
                    View Session
                  </Button>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Adherence Score</span>
                      <span className="font-bold">{trade.adherenceScore ?? 0}%</span>
                    </div>
                    <Progress value={trade.adherenceScore ?? 0} className="h-2" />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>How well did you follow the rules?</Label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { v: 'fully', l: 'Fully Followed', c: 'bg-emerald-500/20 text-emerald-500 border-emerald-500/50' },
                        { v: 'mostly', l: 'Mostly Followed', c: 'bg-teal-500/20 text-teal-500 border-teal-500/50' },
                        { v: 'partially', l: 'Partially Followed', c: 'bg-amber-500/20 text-amber-500 border-amber-500/50' },
                        { v: 'not', l: 'Did Not Follow', c: 'bg-rose-500/20 text-rose-500 border-rose-500/50' }
                      ].map(rating => (
                        <Button
                          key={rating.v}
                          variant={trade.adherenceRating === rating.v ? 'default' : 'outline'}
                          onClick={() => handleChange('adherenceRating', rating.v)}
                          className={trade.adherenceRating === rating.v ? rating.c : ''}
                        >
                          {rating.l}
                        </Button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Adherence Notes</Label>
                    <Textarea 
                      placeholder="Why did you deviate from the rules?"
                      value={trade.adherenceNotes || ''}
                      onChange={e => handleChange('adherenceNotes', e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* SECTION 6: Emotions */}
        {!isQuickMode && (<section className="space-y-6">
          <h2 className="text-lg font-semibold border-b pb-2">6. Emotional State</h2>
          <div className="flex flex-wrap gap-2">
            {EMOTIONS.map(emo => {
              const isSelected = currentEmotions.includes(emo.id);
              return (
                <button
                  key={emo.id}
                  onClick={() => toggleEmotion(emo.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    isSelected 
                      ? `${emo.color} text-white shadow-md scale-105` 
                      : `bg-muted/50 text-muted-foreground hover:bg-muted border border-border`
                  }`}
                >
                  {emo.id}
                </button>
              );
            })}
          </div>
          <div className="space-y-2">
            <Label>Emotion Notes</Label>
            <Textarea 
              placeholder="How did you feel during this trade?"
              value={trade.emotionNotes || ''}
              onChange={e => handleChange('emotionNotes', e.target.value)}
            />
          </div>
        </section>)}

        {/* ── تحلیل چند تایم‌فریمی (MTF) ── */}
        {!isQuickMode && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold border-b pb-2">۶ب. تحلیل چند تایم‌فریمی</h2>
            {(['4H', '15M', '5M', '1M'] as const).map(tf => {
              const mtf = (() => { try { return JSON.parse((trade as any).mtfAnalysis || 'null') || {}; } catch { return {}; } })();
              const tfData = mtf[tf] || {};
              const update = (field: string, value: string) => {
                const newMtf = { ...mtf, [tf]: { ...tfData, [field]: value } };
                handleChange('mtfAnalysis' as any, JSON.stringify(newMtf));
              };
              return (
                <Card key={tf} className="bg-muted/10">
                  <CardContent className="p-4 space-y-3">
                    <div className="font-semibold text-sm">{tf}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">بایاس / جهت</Label>
                        <Input value={tfData.bias || ''} onChange={e => update('bias', e.target.value)} placeholder="صعودی / نزولی / خنثی" className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">ساختار بازار</Label>
                        <Input value={tfData.structure || ''} onChange={e => update('structure', e.target.value)} placeholder="HH/HL، LL/LH" className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <Label className="text-xs">زمینه و یادداشت</Label>
                        <Textarea value={tfData.notes || ''} onChange={e => update('notes', e.target.value)} placeholder={`تحلیل ${tf} را وارد کنید…`} className="min-h-[60px] text-sm" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </section>
        )}

        {/* SECTION 7: Screenshots */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold border-b pb-2">۷. اسکرین‌شات‌ها</h2>
          <ScreenshotManager
            trade={trade}
            allTrades={allTrades}
            onChange={screenshots => handleChange('screenshots', JSON.stringify(screenshots))}
          />
        </section>

        {/* SECTION 8: Review */}
        {!isQuickMode && trade.status === 'closed' && (
          <section className="space-y-6 animate-in slide-in-from-bottom-4">
            <h2 className="text-lg font-semibold border-b pb-2">8. Trade Review</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>What did I do well?</Label>
                <Textarea 
                  value={review.didWell || ''} 
                  onChange={e => handleChange('review', JSON.stringify({ ...review, didWell: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>What did I do wrong?</Label>
                <Textarea 
                  value={review.didWrong || ''} 
                  onChange={e => handleChange('review', JSON.stringify({ ...review, didWrong: e.target.value }))}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>What did I learn?</Label>
                <Textarea 
                  value={review.learned || ''} 
                  onChange={e => handleChange('review', JSON.stringify({ ...review, learned: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Would I take this trade again?</Label>
                <div className="flex gap-2">
                  {['yes', 'no', 'maybe'].map(val => (
                    <Button
                      key={val}
                      variant={review.wouldTakeAgain === val ? 'default' : 'outline'}
                      onClick={() => handleChange('review', JSON.stringify({ ...review, wouldTakeAgain: val }))}
                      className="flex-1 capitalize"
                    >
                      {val}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Was this a valid setup?</Label>
                <div className="flex gap-2">
                  {['yes', 'no', 'unclear'].map(val => (
                    <Button
                      key={val}
                      variant={review.validSetup === val ? 'default' : 'outline'}
                      onClick={() => handleChange('review', JSON.stringify({ ...review, validSetup: val }))}
                      className="flex-1 capitalize"
                    >
                      {val}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* SECTION 9: Notes & Tags */}
        {!isQuickMode && (<section className="space-y-6">
          <h2 className="text-lg font-semibold border-b pb-2">9. Notes & Tags</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tags</Label>
              <Input 
                placeholder="Press Enter to add tags (e.g., trend-following, fvg, overtrading)" 
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const val = e.currentTarget.value.trim();
                    if (val && !tags.includes(val)) {
                      handleChange('tags', JSON.stringify([...tags, val]));
                      e.currentTarget.value = '';
                    }
                  }
                }}
              />
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map(tag => (
                  <span key={tag} className="bg-primary/10 text-primary px-2 py-1 rounded-md text-sm flex items-center gap-1">
                    {tag}
                    <X 
                      className="w-3 h-3 cursor-pointer hover:text-primary/70" 
                      onClick={() => handleChange('tags', JSON.stringify(tags.filter(t => t !== tag)))} 
                    />
                  </span>
                ))}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>درس معامله</Label>
              <Textarea
                placeholder="از این معامله چه یاد گرفتید؟ چه نکته‌ای برای آینده دارد؟"
                value={(trade as any).lesson || ''}
                onChange={e => handleChange('lesson' as any, e.target.value || null)}
                className="min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label>General Notes</Label>
              <Textarea 
                placeholder="Any additional thoughts on this trade..."
                value={trade.notes || ''}
                onChange={e => handleChange('notes', e.target.value)}
                className="min-h-[120px]"
              />
            </div>
          </div>
        </section>)}

      </div>
    </div>
  );
}
