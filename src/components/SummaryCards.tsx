import { useMemo } from 'react';
import { type StoreData, type Category, type CellStatus } from '@/hooks/useExpenseStore';
import { AlertTriangle, CheckCircle2, ArrowRightLeft, TrendingUp, CreditCard } from 'lucide-react';

const PAID_SET = new Set<CellStatus>(['paid-M', 'paid-J', 'paid-MJ']);

interface Props { data: StoreData }

function getCurrentMonthIndex(year: number): number | null {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  if (y === year && m >= 4) return m - 4;
  if (y === year + 1 && m <= 3) return m + 8;
  return null;
}

const MONTHS_SHORT = ['Maj','Cze','Lip','Sie','Wrz','Paź','Lis','Gru','Sty','Lut','Mar','Kwi'];
const PAID = new Set(['paid-M','paid-J','paid-MJ']);

function computeYear(data: StoreData) {
  let mPaid = 0, mTotal = 0, mPaidAmt = 0, mTotalAmt = 0;
  let jPaid = 0, jTotal = 0, jPaidAmt = 0, jTotalAmt = 0;
  for (const cat of data.categories) {
    const isM = cat.assignedTo === 'M' || cat.assignedTo === 'M+J';
    const isJ = cat.assignedTo === 'J' || cat.assignedTo === 'M+J';
    for (let m = 0; m < 12; m++) {
      const s = data.cells.find(c => c.categoryId === cat.id && c.monthIndex === m)?.status ?? 'unpaid';
      if (s === 'not-required') continue;
      if (isM) { mTotal++; mTotalAmt += cat.amount; if (s === 'paid-M' || s === 'paid-MJ') { mPaid++; mPaidAmt += cat.amount; } }
      if (isJ) { jTotal++; jTotalAmt += cat.amount; if (s === 'paid-J' || s === 'paid-MJ') { jPaid++; jPaidAmt += cat.amount; } }
    }
  }
  return { mPaid, mTotal, mPaidAmt, mTotalAmt, jPaid, jTotal, jPaidAmt, jTotalAmt };
}

function computeMonth(data: StoreData, mi: number) {
  let mDue = 0, mPaid = 0, jDue = 0, jPaid = 0;
  for (const cat of data.categories) {
    if (!cat.amount) continue;
    const s = data.cells.find(c => c.categoryId === cat.id && c.monthIndex === mi)?.status ?? 'unpaid';
    if (s === 'not-required') continue;
    const isM = cat.assignedTo === 'M' || cat.assignedTo === 'M+J';
    const isJ = cat.assignedTo === 'J' || cat.assignedTo === 'M+J';
    if (isM) { mDue += cat.amount; if (s === 'paid-M' || s === 'paid-MJ') mPaid += cat.amount; }
    if (isJ) { jDue += cat.amount; if (s === 'paid-J' || s === 'paid-MJ') jPaid += cat.amount; }
  }
  return { mDue, mPaid, mRem: mDue - mPaid, jDue, jPaid, jRem: jDue - jPaid };
}

function computeSettlement(data: StoreData, mi: number) {
  let jOwesM = 0;
  let mOwesJ = 0;
  for (const cat of data.categories) {
    if (cat.assignedTo !== 'M+J' || !cat.amount) continue;
    const s = data.cells.find(c => c.categoryId === cat.id && c.monthIndex === mi)?.status ?? 'unpaid';
    const half = cat.amount / 2;
    if (s === 'paid-M') jOwesM += half;
    else if (s === 'paid-J') mOwesJ += half;
  }
  if (jOwesM === 0 && mOwesJ === 0) return null;
  const net = jOwesM - mOwesJ;
  return { net };
}

function computeDueAlerts(data: StoreData, mi: number): { cat: Category; daysLeft: number }[] {
  const todayDay = new Date().getDate();
  return data.categories
    .filter(cat => cat.dueDay)
    .map(cat => {
      const s = data.cells.find(c => c.categoryId === cat.id && c.monthIndex === mi)?.status ?? 'unpaid';
      if (PAID.has(s) || s === 'not-required') return null;
      return { cat, daysLeft: (cat.dueDay ?? 0) - todayDay };
    })
    .filter((x): x is { cat: Category; daysLeft: number } => x !== null && x.daysLeft <= 5)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

function ProgressRing({ pct, size = 68, sw = 5.5, colorVar }: {
  pct: number; size?: number; sw?: number; colorVar: string;
}) {
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(pct, 100) / 100);
  return (
    <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
      <circle cx={size/2} cy={size/2} r={r} fill="none" strokeWidth={sw} stroke="currentColor"
        className="text-border opacity-40" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" strokeWidth={sw} strokeLinecap="round"
        strokeDasharray={circ}
        style={{ stroke: `hsl(var(${colorVar}))`, strokeDashoffset: offset, transition: 'stroke-dashoffset 0.9s ease-out' }} />
    </svg>
  );
}

function YearCard({ label, paid, total, paidAmt, totalAmt, hasAmounts, colorVar, accentCss }: {
  label: string; paid: number; total: number; paidAmt: number; totalAmt: number;
  hasAmounts: boolean; colorVar: string; accentCss: string;
}) {
  const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
  const remaining = total - paid;
  const isDone = remaining === 0 && total > 0;
  const badgeClass = label === 'M' ? 'badge-m' : 'badge-j';

  return (
    <div className="rounded-2xl border border-border bg-card flex-1 min-w-[200px] flex items-center gap-4 shadow-sm overflow-hidden relative">
      {/* Left accent bar */}
      <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: `hsl(var(${accentCss}))` }} />

      <div className="pl-5 pr-4 py-4 flex items-center gap-4 w-full">
        {/* Ring */}
        <div className="relative shrink-0">
          <ProgressRing pct={pct} colorVar={colorVar} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${badgeClass}`}>{label}</span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex-1 min-w-0">
          <div className="flex items-end gap-1.5">
            <span className="text-3xl font-extrabold leading-none text-foreground">{pct}%</span>
            {isDone && <span className="text-sm mb-0.5">🎉</span>}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            <span className="font-semibold text-foreground">{paid}/{total}</span> opłacone w roku
          </div>
          {hasAmounts && totalAmt > 0 && (
            <div className="text-xs text-muted-foreground">
              {paidAmt.toLocaleString('pl-PL')} / {totalAmt.toLocaleString('pl-PL')} zł
            </div>
          )}
          {remaining > 0 && (
            <div className="text-xs font-semibold text-destructive mt-1">
              {remaining} pozostałe
            </div>
          )}
        </div>

        {/* Mini trend icon */}
        <TrendingUp className="h-4 w-4 text-muted-foreground/30 shrink-0 self-start mt-1" />
      </div>
    </div>
  );
}

function InstallmentCard({ data }: { data: StoreData }) {
  const cats = data.categories.filter(c => c.installmentMonths && c.installmentMonths > 0);
  if (cats.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border/60 flex items-center gap-2 bg-primary/5">
        <CreditCard className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="text-xs font-semibold text-foreground">Aktywne raty</span>
        <span className="ml-auto text-[10px] text-muted-foreground">{cats.length} {cats.length === 1 ? 'pozycja' : cats.length < 5 ? 'pozycje' : 'pozycji'}</span>
      </div>
      <div className="divide-y divide-border/40">
        {cats.map(cat => {
          const paidN  = data.cells.filter(c => c.categoryId === cat.id && PAID_SET.has(c.status)).length;
          const total  = cat.installmentMonths!;
          const left   = Math.max(0, total - paidN);
          const pct    = Math.min(100, Math.round((paidN / total) * 100));
          const done   = paidN >= total;
          const totalAmt = cat.amount > 0 ? cat.amount * total : 0;
          const leftAmt  = cat.amount > 0 ? cat.amount * left : 0;
          const badgeCls = cat.assignedTo === 'M' ? 'badge-m' : cat.assignedTo === 'J' ? 'badge-j' : 'badge-mj';

          return (
            <div key={cat.id} className="px-4 py-3 flex flex-col gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                {cat.color && (
                  <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                )}
                <span className="font-medium text-sm text-foreground flex-1 min-w-0 truncate">{cat.name}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${badgeCls}`}>{cat.assignedTo}</span>
                {done ? (
                  <span className="text-[10px] font-bold text-green-600 dark:text-green-400 flex items-center gap-0.5 shrink-0">
                    <CheckCircle2 className="h-3 w-3" /> Spłacono!
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-primary shrink-0">{paidN}/{total} rat</span>
                )}
              </div>

              {/* Progress bar */}
              <div className="space-y-1">
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${done ? 'bg-green-500' : 'bg-primary'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>
                    {done
                      ? '✓ Wszystkie raty zapłacone'
                      : `${left} ${left === 1 ? 'rata' : left < 5 ? 'raty' : 'rat'} pozostało`}
                    {!done && cat.amount > 0 && (
                      <span className="ml-1 font-medium text-foreground">
                        · {leftAmt.toLocaleString('pl-PL')} zł
                      </span>
                    )}
                  </span>
                  <span className="font-semibold">
                    {pct}%
                    {totalAmt > 0 && (
                      <span className="font-normal ml-1">z {totalAmt.toLocaleString('pl-PL')} zł</span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function SummaryCards({ data }: Props) {
  const year    = useMemo(() => computeYear(data), [data]);
  const mi      = useMemo(() => getCurrentMonthIndex(data.year), [data.year]);
  const mon     = useMemo(() => mi !== null ? computeMonth(data, mi) : null, [data, mi]);
  const settle  = useMemo(() => mi !== null ? computeSettlement(data, mi) : null, [data, mi]);
  const alerts  = useMemo(() => mi !== null ? computeDueAlerts(data, mi) : [], [data, mi]);
  const hasAmounts = data.categories.some(c => c.amount > 0);

  return (
    <div className="space-y-3 mb-4">
      {/* Year progress rings */}
      <div className="flex gap-3 flex-wrap">
        <YearCard
          label="M" paid={year.mPaid} total={year.mTotal}
          paidAmt={year.mPaidAmt} totalAmt={year.mTotalAmt}
          hasAmounts={hasAmounts} colorVar="--chart-1" accentCss="--chart-1"
        />
        <YearCard
          label="J" paid={year.jPaid} total={year.jTotal}
          paidAmt={year.jPaidAmt} totalAmt={year.jTotalAmt}
          hasAmounts={hasAmounts} colorVar="--chart-2" accentCss="--chart-2"
        />
      </div>

      {/* This month breakdown */}
      {mon && hasAmounts && mi !== null && (
        <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold text-muted-foreground shrink-0 flex items-center gap-1.5">
              📅 <span>{MONTHS_SHORT[mi]} — bieżący miesiąc</span>
            </span>
            <div className="flex flex-wrap gap-4 flex-1">
              {([
                { lbl: 'M', due: mon.mDue, paid: mon.mPaid, rem: mon.mRem, cls: 'badge-m' },
                { lbl: 'J', due: mon.jDue, paid: mon.jPaid, rem: mon.jRem, cls: 'badge-j' },
              ] as const).map(u => (
                <span key={u.lbl} className="flex items-center gap-1.5 text-xs">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${u.cls}`}>{u.lbl}</span>
                  <span className="text-green-600 dark:text-green-400 font-medium">✓ {u.paid.toLocaleString('pl-PL')} zł</span>
                  {u.rem > 0 && (
                    <span className="font-semibold text-destructive">· {u.rem.toLocaleString('pl-PL')} zł do zapłaty</span>
                  )}
                  {u.rem === 0 && u.due > 0 && (
                    <span className="font-semibold text-green-600 dark:text-green-400">· gotowe 🎉</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Monthly settlement */}
      {settle && mi !== null && (
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-xs shadow-sm flex items-center gap-2 flex-wrap">
          <ArrowRightLeft className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="font-semibold text-muted-foreground shrink-0">Rozliczenie {MONTHS_SHORT[mi]}:</span>
          {settle.net === 0 ? (
            <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-semibold">
              <CheckCircle2 className="h-3 w-3" /> Wszystko wyrównane
            </span>
          ) : settle.net > 0 ? (
            <span className="font-semibold flex items-center gap-1">
              <span className="badge-j text-[10px] font-bold px-1.5 py-0.5 rounded-full">J</span>
              <span className="text-muted-foreground">dopłaca</span>
              <span className="badge-m text-[10px] font-bold px-1.5 py-0.5 rounded-full">M</span>
              <span className="text-foreground font-bold ml-0.5">{settle.net.toLocaleString('pl-PL', { maximumFractionDigits: 2 })} zł</span>
            </span>
          ) : (
            <span className="font-semibold flex items-center gap-1">
              <span className="badge-m text-[10px] font-bold px-1.5 py-0.5 rounded-full">M</span>
              <span className="text-muted-foreground">dopłaca</span>
              <span className="badge-j text-[10px] font-bold px-1.5 py-0.5 rounded-full">J</span>
              <span className="text-foreground font-bold ml-0.5">{Math.abs(settle.net).toLocaleString('pl-PL', { maximumFractionDigits: 2 })} zł</span>
            </span>
          )}
          <span className="text-muted-foreground/50 ml-auto text-[10px] hidden sm:block">na podstawie kategorii M+J</span>
        </div>
      )}

      {/* Installments */}
      <InstallmentCard data={data} />

      {/* Due date alerts */}
      {alerts.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 space-y-1.5 shadow-sm">
          <p className="text-xs font-semibold text-destructive flex items-center gap-1.5 mb-2">
            <AlertTriangle className="h-3.5 w-3.5" /> Nadchodzące terminy płatności:
          </p>
          {alerts.map(({ cat, daysLeft }) => (
            <div key={cat.id} className="flex items-center gap-2 text-xs">
              {cat.color && (
                <span className="inline-block w-2 h-2 rounded-full shrink-0 border border-border/20" style={{ backgroundColor: cat.color }} />
              )}
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${cat.assignedTo === 'M' ? 'badge-m' : cat.assignedTo === 'J' ? 'badge-j' : 'badge-mj'}`}>
                {cat.assignedTo}
              </span>
              <span className="font-medium text-foreground">{cat.name}</span>
              <span className="text-muted-foreground">— termin {cat.dueDay}.</span>
              {daysLeft < 0
                ? <span className="font-bold text-destructive ml-auto">zaległe ({Math.abs(daysLeft)} dni temu)</span>
                : daysLeft === 0
                ? <span className="font-bold text-destructive ml-auto">dziś!</span>
                : <span className="font-semibold text-orange-600 dark:text-orange-400 ml-auto">za {daysLeft} dni</span>
              }
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
