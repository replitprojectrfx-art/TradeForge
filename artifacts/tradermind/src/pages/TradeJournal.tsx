import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Skeleton } from "../components/ui/skeleton";
import { tradeService } from "../services/tradeService";
import { strategyService } from "../services/strategyService";
import { Trade, Strategy } from "../db/database";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  PlusCircle, TrendingUp, TrendingDown, Search, Filter,
  CalendarIcon, ChevronDown, ChevronUp, Upload,
} from "lucide-react";
import { scoreOneTrade } from "../services/dataQualityService";
import { format } from "date-fns";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../components/ui/collapsible";
import { t } from "../lib/i18n";

const RESULT_COLORS: Record<string, string> = {
  win:           'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  loss:          'bg-rose-500/10 text-rose-500 border-rose-500/20',
  breakeven:     'bg-slate-500/10 text-slate-500 border-slate-500/20',
  'partial-win': 'bg-teal-500/10 text-teal-500 border-teal-500/20',
  'partial-loss':'bg-amber-500/10 text-amber-500 border-amber-500/20',
  open:          'bg-blue-500/10 text-blue-500 border-blue-500/20',
  cancelled:     'bg-muted text-muted-foreground border-border',
};

const RESULT_FA: Record<string, string> = {
  win: 'سود', loss: 'ضرر', breakeven: 'سر به سر',
  'partial-win': 'سود جزئی', 'partial-loss': 'ضرر جزئی',
  open: 'باز', cancelled: 'لغو',
};

const DIRECTION_FA: Record<string, string> = { long: 'خرید', short: 'فروش' };

const ADHERENCE_FA: Record<string, string> = {
  fully: 'کاملاً', mostly: 'تا حد زیادی', partially: 'کمی', not: 'اصلاً',
};

export default function TradeJournal() {
  const [, setLocation] = useLocation();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [stats, setStats] = useState({ total: 0, winRate: 0, totalPnl: 0, avgRMultiple: 0 });
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({
    search: '', result: 'all', direction: 'all', strategyId: 'all',
    emotion: 'all', adherenceRating: 'all', dateFrom: '', dateTo: '',
  });

  useEffect(() => { strategyService.getAllStrategies().then(setStrategies); }, []);
  useEffect(() => { loadData(); }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    setLoading(true);
    const f = {
      ...filters,
      dateFrom: filters.dateFrom ? new Date(filters.dateFrom).getTime() : undefined,
      dateTo: filters.dateTo ? new Date(filters.dateTo).setHours(23, 59, 59, 999) : undefined,
    };
    const [data, currentStats] = await Promise.all([
      tradeService.getTradesWithFilters(f),
      tradeService.getStats(),
    ]);
    setTrades(data);
    setStats(currentStats);
    setLoading(false);
  };

  const handleFilterChange = (key: string, value: string) =>
    setFilters(prev => ({ ...prev, [key]: value }));

  const clearFilters = () => setFilters({
    search: '', result: 'all', direction: 'all', strategyId: 'all',
    emotion: 'all', adherenceRating: 'all', dateFrom: '', dateTo: '',
  });

  const activeFiltersCount = Object.values(filters).filter(v => v !== 'all' && v !== '').length;
  const emotions = t.defaultEmotions;

  if (loading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300 pb-12">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-60" />
          </div>
          <Skeleton className="h-11 w-36 rounded-lg" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-12 rounded-xl" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">

      {/* هدر */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">دفتر معاملات</h1>
          <p className="text-muted-foreground mt-1">معاملات خود را ثبت و بررسی کنید.</p>
        </div>
        <Link href="/journal/trades/new">
          <Button size="lg" className="gap-2 shadow-lg w-full sm:w-auto">
            <PlusCircle className="h-5 w-5" /> ثبت معامله جدید
          </Button>
        </Link>
      </div>

      {/* آمار سریع */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'کل معاملات', value: stats.total },
          { label: 'نرخ برد', value: `${stats.winRate.toFixed(1)}٪` },
          {
            label: 'سود/زیان کل',
            value: `${stats.totalPnl >= 0 ? '+' : ''}${stats.totalPnl.toFixed(2)}`,
            cls: stats.totalPnl > 0 ? 'text-emerald-500' : stats.totalPnl < 0 ? 'text-rose-500' : '',
          },
          { label: 'میانگین R', value: `${stats.avgRMultiple.toFixed(2)}R` },
        ].map((s, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">{s.label}</div>
              <div className={`text-2xl font-bold ${s.cls ?? ''}`}>{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* جستجو و فیلتر */}
      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}
        className="border rounded-xl bg-card overflow-hidden">
        <div className="flex items-center justify-between p-3 sm:p-4 bg-muted/20 gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="جستجو نماد..."
              value={filters.search}
              onChange={e => handleFilterChange('search', e.target.value)}
              className="pr-9 h-9 bg-background"
            />
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 shrink-0">
              <Filter className="w-4 h-4" />
              <span className="hidden sm:inline">فیلترها</span>
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="rounded-full px-1.5 py-0 min-w-[20px] h-5">
                  {activeFiltersCount}
                </Badge>
              )}
              {filtersOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent className="p-4 border-t bg-muted/5">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* نتیجه */}
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground">نتیجه</div>
              <Select value={filters.result} onValueChange={v => handleFilterChange('result', v)}>
                <SelectTrigger className="h-9 bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه نتایج</SelectItem>
                  <SelectItem value="win">سود</SelectItem>
                  <SelectItem value="loss">ضرر</SelectItem>
                  <SelectItem value="breakeven">سر به سر</SelectItem>
                  <SelectItem value="partial-win">سود جزئی</SelectItem>
                  <SelectItem value="partial-loss">ضرر جزئی</SelectItem>
                  <SelectItem value="open">باز</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* جهت */}
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground">جهت</div>
              <Select value={filters.direction} onValueChange={v => handleFilterChange('direction', v)}>
                <SelectTrigger className="h-9 bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه جهت‌ها</SelectItem>
                  <SelectItem value="long">خرید (Long)</SelectItem>
                  <SelectItem value="short">فروش (Short)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* استراتژی */}
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground">استراتژی</div>
              <Select value={filters.strategyId} onValueChange={v => handleFilterChange('strategyId', v)}>
                <SelectTrigger className="h-9 bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه استراتژی‌ها</SelectItem>
                  {strategies.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* احساس */}
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground">احساس</div>
              <Select value={filters.emotion} onValueChange={v => handleFilterChange('emotion', v)}>
                <SelectTrigger className="h-9 bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه احساسات</SelectItem>
                  {emotions.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* پیروی از قوانین */}
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground">پیروی از قوانین</div>
              <Select value={filters.adherenceRating} onValueChange={v => handleFilterChange('adherenceRating', v)}>
                <SelectTrigger className="h-9 bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه</SelectItem>
                  <SelectItem value="fully">کاملاً پیروی</SelectItem>
                  <SelectItem value="mostly">تا حد زیادی</SelectItem>
                  <SelectItem value="partially">کمی</SelectItem>
                  <SelectItem value="not">اصلاً پیروی نکرده</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* از تاریخ */}
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground">از تاریخ</div>
              <Input type="date" value={filters.dateFrom}
                onChange={e => handleFilterChange('dateFrom', e.target.value)}
                className="h-9 bg-background" />
            </div>

            {/* تا تاریخ */}
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground">تا تاریخ</div>
              <Input type="date" value={filters.dateTo}
                onChange={e => handleFilterChange('dateTo', e.target.value)}
                className="h-9 bg-background" />
            </div>

            {activeFiltersCount > 0 && (
              <div className="flex items-end">
                <Button variant="ghost" className="h-9 w-full text-muted-foreground hover:text-foreground"
                  onClick={clearFilters}>
                  پاک کردن فیلترها
                </Button>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* تعداد نتایج */}
      <div className="text-sm text-muted-foreground">
        نمایش {trades.length} معامله
      </div>

      {/* حالت خالی */}
      {trades.length === 0 ? (
        <Card className="border-dashed bg-transparent">
          <CardContent className="flex flex-col items-center justify-center py-16 sm:py-24 text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
              <TrendingUp className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold">معامله‌ای یافت نشد</h2>
            <p className="text-muted-foreground max-w-sm">
              {activeFiltersCount > 0
                ? 'فیلترها را تغییر دهید تا نتایج بیشتری ببینید.'
                : 'اولین معامله خود را ثبت کنید.'}
            </p>
            {activeFiltersCount > 0 ? (
              <Button variant="outline" onClick={clearFilters}>پاک کردن فیلترها</Button>
            ) : (
              <Button onClick={() => setLocation('/journal/trades/new')}>
                <PlusCircle className="w-4 h-4 ml-2" /> ثبت اولین معامله
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* جدول — دسکتاپ */}
          <div className="hidden md:block rounded-xl border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b">
                  <tr>
                    <th className="px-4 py-3 font-medium text-right">تاریخ</th>
                    <th className="px-4 py-3 font-medium text-right">نماد</th>
                    <th className="px-4 py-3 font-medium text-right">جهت</th>
                    <th className="px-4 py-3 font-medium text-right">نتیجه</th>
                    <th className="px-4 py-3 font-medium text-left">ورود</th>
                    <th className="px-4 py-3 font-medium text-left">خروج</th>
                    <th className="px-4 py-3 font-medium text-left">سود/زیان</th>
                    <th className="px-4 py-3 font-medium text-left">R</th>
                    <th className="px-4 py-3 font-medium text-center">پیروی</th>
                    <th className="px-4 py-3 font-medium text-center">کامل‌بودن</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {trades.map(trade => (
                    <tr key={trade.id} onClick={() => setLocation(`/journal/trades/${trade.id}`)}
                      className="hover:bg-muted/30 transition-colors cursor-pointer">
                      <td className="px-4 py-3 text-muted-foreground">
                        {format(new Date(trade.openedAt), 'MM/dd HH:mm')}
                      </td>
                      <td className="px-4 py-3 font-bold">{trade.symbol}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`h-6 text-[10px] ${trade.direction === 'long'
                          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-500 border-rose-500/20'}`}>
                          {DIRECTION_FA[trade.direction] || trade.direction}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`h-6 ${RESULT_COLORS[trade.result] || ''}`}>
                          {RESULT_FA[trade.result] || trade.result}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 tabular-nums">{trade.entryPrice}</td>
                      <td className="px-4 py-3 tabular-nums">{trade.exitPrice ?? '-'}</td>
                      <td className={`px-4 py-3 tabular-nums font-medium ${trade.profitLoss
                        ? (trade.profitLoss > 0 ? 'text-emerald-500' : 'text-rose-500') : ''}`}>
                        {trade.profitLoss !== null ? `$${trade.profitLoss.toFixed(2)}` : '-'}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {trade.rMultiple !== null ? `${trade.rMultiple}R` : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {trade.adherenceScore !== null ? (
                          <span className="font-medium text-primary">{trade.adherenceScore}٪</span>
                        ) : trade.adherenceRating ? (
                          <span className="text-muted-foreground text-xs">
                            {ADHERENCE_FA[trade.adherenceRating] || trade.adherenceRating}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {(() => {
                          const s = scoreOneTrade(trade).score;
                          return (
                            <span className={`text-xs font-medium tabular-nums ${s >= 80 ? 'text-emerald-500' : s >= 60 ? 'text-amber-500' : 'text-rose-500'}`}>
                              {s}٪
                            </span>
                          );
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* کارت — موبایل */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {trades.map(trade => (
              <Card key={trade.id} className="cursor-pointer hover:border-primary/50 transition-colors card-pressable"
                onClick={() => setLocation(`/journal/trades/${trade.id}`)}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <h3 className="font-bold text-lg truncate">{trade.symbol}</h3>
                      <Badge variant="outline" className={`h-5 text-[10px] shrink-0 ${trade.direction === 'long'
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-500 border-rose-500/20'}`}>
                        {DIRECTION_FA[trade.direction] || trade.direction}
                      </Badge>
                    </div>
                    <Badge variant="outline" className={`${RESULT_COLORS[trade.result] || ''} shrink-0`}>
                      {RESULT_FA[trade.result] || trade.result}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <CalendarIcon className="w-3 h-3 shrink-0" />
                      {format(new Date(trade.openedAt), 'MMM d, yyyy HH:mm')}
                    </div>
                    {(() => {
                      const s = scoreOneTrade(trade).score;
                      return (
                        <div className="flex items-center gap-1.5">
                          <div className="w-12 h-1 rounded-full bg-muted/30 overflow-hidden">
                            <div className="h-full rounded-full" style={{
                              width: `${s}%`,
                              backgroundColor: s >= 80 ? '#22c55e' : s >= 60 ? '#eab308' : '#ef4444'
                            }} />
                          </div>
                          <span className={`text-[10px] font-medium ${s >= 80 ? 'text-emerald-500' : s >= 60 ? 'text-amber-500' : 'text-rose-500'}`}>{s}٪</span>
                        </div>
                      );
                    })()}
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t text-sm">
                    <div>
                      <div className="text-muted-foreground text-[10px] uppercase mb-0.5">ورود</div>
                      <div className="font-medium">{trade.entryPrice}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-[10px] uppercase mb-0.5">سود/زیان</div>
                      <div className={`font-medium ${trade.profitLoss
                        ? (trade.profitLoss > 0 ? 'text-emerald-500' : 'text-rose-500') : ''}`}>
                        {trade.profitLoss !== null ? `$${trade.profitLoss.toFixed(2)}` : '-'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-muted-foreground text-[10px] uppercase mb-0.5">R</div>
                      <div className="font-medium">
                        {trade.rMultiple !== null ? `${trade.rMultiple}R` : '-'}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
