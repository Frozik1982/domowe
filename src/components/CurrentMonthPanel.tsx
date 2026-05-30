import { useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronDown, ChevronUp, CircleDollarSign, Clock3, ReceiptText, Scale } from 'lucide-react';
import { type CellStatus, type Category, type StoreData } from '@/hooks/useExpenseStore';
import { usePayerNames, paymentStatusLabel } from '@/hooks/usePayerNames';

const MONTHS = ['Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień','Styczeń','Luty','Marzec','Kwiecień'];
const PAID = new Set<CellStatus>(['paid-M', 'paid-J', 'paid-MJ']);

function getCurrentMonthIndex(year: number): number | null {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (y === year && m >= 4) return m - 4;
  if (y === year + 1 && m <= 3) return m + 8;
  return null;
}

function money(v: number): string {
  return `${v.toLocaleString('pl-PL', { maximumFractionDigits: 2 })} zł`;
}

function getStatus(data: StoreData, categoryId: string, monthIndex: number): CellStatus {
  return data.cells.find(c => c.categoryId === categoryId && c.monthIndex === monthIndex)?.status ?? 'unpaid';
}

function isMonthCurrent(dataYear: number, mi: number): boolean {
  return getCurrentMonthIndex(dataYear) === mi;
}

function getDueState(dataYear: number, mi: number, cat: Category, status: CellStatus): 'paid' | 'overdue' | 'today' | 'soon' | 'later' | 'none' {
  if (!cat.dueDay || status === 'not-required') return 'none';
  if (PAID.has(status)) return 'paid';
  if (!isMonthCurrent(dataYear, mi)) return 'later';
  const left = cat.dueDay - new Date().getDate();
  if (left < 0) return 'overdue';
  if (left === 0) return 'today';
  if (left <= 5) return 'soon';
  return 'later';
}


function statusClass(status: CellStatus): string {
  if (status === 'paid-M') return 'badge-m';
  if (status === 'paid-J') return 'badge-j';
  if (status === 'paid-MJ') return 'badge-mj';
  if (status === 'not-required') return 'bg-muted text-muted-foreground';
  return 'bg-orange-500/10 text-orange-400 border border-orange-500/20';
}

interface Props { data: StoreData }

export default function CurrentMonthPanel({ data }: Props) {
  const [showDetails, setShowDetails] = useState(false);
  const { names } = usePayerNames();
  const currentMonthIndex = useMemo(() => getCurrentMonthIndex(data.year), [data.year]);

  const summary = useMemo(() => {
    if (currentMonthIndex === null) return null;

    let total = 0;
    let paid = 0;
    let requiredCount = 0;
    let paidCount = 0;
    let paidByM = 0;
    let paidByJ = 0;
    let jOwesM = 0;
    let mOwesJ = 0;
    let notRequiredCount = 0;

    const items = data.categories.map(cat => {
      const status = getStatus(data, cat.id, currentMonthIndex);
      const required = status !== 'not-required';
      const isPaid = PAID.has(status);
      const amount = cat.amount || 0;
      const dueState = getDueState(data.year, currentMonthIndex, cat, status);

      if (required) {
        requiredCount += 1;
        total += amount;
      } else {
        notRequiredCount += 1;
      }
      if (isPaid) {
        paidCount += 1;
        paid += amount;
      }

      if (amount > 0) {
        if (status === 'paid-M') paidByM += amount;
        if (status === 'paid-J') paidByJ += amount;
        if (status === 'paid-MJ') {
          paidByM += amount / 2;
          paidByJ += amount / 2;
        }
        if (cat.assignedTo === 'M+J') {
          if (status === 'paid-M') jOwesM += amount / 2;
          if (status === 'paid-J') mOwesJ += amount / 2;
        }
      }

      return { cat, status, amount, required, isPaid, dueState, note: data.cells.find(c => c.categoryId === cat.id && c.monthIndex === currentMonthIndex)?.note ?? '' };
    });

    const remaining = Math.max(0, total - paid);
    const net = jOwesM - mOwesJ;
    const alerts = items.filter(i => ['overdue', 'today', 'soon'].includes(i.dueState));
    const overdueCount = items.filter(i => i.dueState === 'overdue').length;
    const soonCount = items.filter(i => i.dueState === 'today' || i.dueState === 'soon').length;
    const unpaidCount = items.filter(i => i.required && !i.isPaid).length;
    const hasMoney = items.some(i => i.amount > 0);

    return { total, paid, remaining, requiredCount, paidCount, paidByM, paidByJ, net, alerts, items, overdueCount, soonCount, unpaidCount, notRequiredCount, hasMoney };
  }, [data, currentMonthIndex]);

  if (currentMonthIndex === null || !summary) {
    return (
      <section className="rounded-2xl border border-border bg-card p-4 mb-4 shadow-sm print:hidden">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <CalendarDays className="h-4 w-4 text-primary" /> Ten miesiąc
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Aktualny miesiąc nie należy do wybranego roku rozliczeniowego.
        </p>
      </section>
    );
  }

  const monthName = MONTHS[currentMonthIndex];
  const pct = summary.requiredCount > 0 ? Math.round((summary.paidCount / summary.requiredCount) * 100) : 0;

  return (
    <section className="rounded-2xl border border-border bg-card mb-4 shadow-sm overflow-hidden print:hidden">
      <div className="px-4 py-3 border-b border-border/70 bg-muted/15">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-4 w-4 text-primary shrink-0" />
          <div className="min-w-0 mr-auto">
            <h2 className="text-sm font-bold text-foreground leading-tight">Ten miesiąc — {monthName}</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {summary.paidCount}/{summary.requiredCount} opłacone · {summary.unpaidCount} pozostało
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-2xl font-black text-foreground leading-none">{pct}%</div>
            <div className="text-[10px] text-muted-foreground">postęp</div>
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="px-4 py-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1.5 text-xs font-bold text-orange-300">
            Do zapłaty: {summary.unpaidCount}
          </div>
          <div className={`rounded-full border px-3 py-1.5 text-xs font-bold ${summary.overdueCount > 0 ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-border bg-muted/20 text-muted-foreground'}`}>
            Zaległe: {summary.overdueCount}
          </div>
          <div className={`rounded-full border px-3 py-1.5 text-xs font-bold ${summary.soonCount > 0 ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300' : 'border-border bg-muted/20 text-muted-foreground'}`}>
            Nadchodzące: {summary.soonCount}
          </div>
          {summary.notRequiredCount > 0 && (
            <div className="rounded-full border border-border bg-muted/20 px-3 py-1.5 text-xs font-bold text-muted-foreground">
              Niewymagane: {summary.notRequiredCount}
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowDetails(v => !v)}
            className="ml-auto inline-flex items-center gap-2 rounded-full border border-border bg-muted/20 px-3 py-1.5 text-xs font-bold text-foreground hover:bg-muted/40 transition-colors"
          >
            {showDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {showDetails ? 'Ukryj szczegóły' : 'Pokaż szczegóły'}
          </button>
        </div>

        {summary.hasMoney && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
            <div className="rounded-xl border border-border/70 bg-muted/15 p-2.5">
              <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wide text-muted-foreground"><CircleDollarSign className="h-3 w-3" /> Razem</div>
              <div className="text-sm font-bold text-foreground mt-1">{money(summary.total)}</div>
            </div>
            <div className="rounded-xl border border-border/70 bg-green-500/5 p-2.5">
              <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wide text-muted-foreground"><CheckCircle2 className="h-3 w-3" /> Opłacone</div>
              <div className="text-sm font-bold text-green-400 mt-1">{money(summary.paid)}</div>
            </div>
            <div className="rounded-xl border border-border/70 bg-orange-500/5 p-2.5">
              <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wide text-muted-foreground"><Clock3 className="h-3 w-3" /> Pozostało</div>
              <div className="text-sm font-bold text-orange-400 mt-1">{money(summary.remaining)}</div>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/15 p-2.5">
              <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wide text-muted-foreground"><ReceiptText className="h-3 w-3" /> M / J</div>
              <div className="text-xs font-bold text-foreground mt-1"><span className="text-blue-300">{names.m} {money(summary.paidByM)}</span> · <span className="text-violet-300">{names.j} {money(summary.paidByJ)}</span></div>
            </div>
            <div className="rounded-xl border border-border/70 bg-primary/5 p-2.5 col-span-2 lg:col-span-1">
              <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wide text-muted-foreground"><Scale className="h-3 w-3" /> Do wyrównania</div>
              <div className="text-xs font-bold text-foreground mt-1">
                {summary.net === 0 ? 'Wyrównane' : summary.net > 0 ? `${names.j} → ${names.m} ${money(summary.net)}` : `${names.m} → ${names.j} ${money(Math.abs(summary.net))}`}
              </div>
            </div>
          </div>
        )}

        {!showDetails && summary.alerts.length > 0 && (
          <div className="rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs text-destructive flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="font-semibold">Masz {summary.alerts.length} ważne terminy w tym miesiącu.</span>
          </div>
        )}

        {showDetails && (
          <div className="space-y-3">
            {summary.alerts.length > 0 && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
                <div className="flex items-center gap-2 text-xs font-bold text-destructive mb-2">
                  <AlertTriangle className="h-4 w-4" /> Alerty terminów
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {summary.alerts.map(({ cat, dueState, amount }) => (
                    <div key={cat.id} className="rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-xs flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${dueState === 'overdue' ? 'bg-red-500' : dueState === 'today' ? 'bg-orange-400' : 'bg-yellow-400'}`} />
                      <span className="font-semibold text-foreground truncate">{cat.name}</span>
                      <span className="text-muted-foreground ml-auto shrink-0">{amount > 0 ? money(amount) : 'brak kwoty'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-xl border border-border/70 overflow-hidden">
              <div className="px-3 py-2 bg-muted/20 border-b border-border/60 text-xs font-semibold text-muted-foreground">
                Pozycje w tym miesiącu
              </div>
              <div className="divide-y divide-border/50 max-h-56 overflow-auto category-scroll">
                {summary.items.map(({ cat, status, amount, dueState, note }) => (
                  <div key={cat.id} className="px-3 py-2 flex items-center gap-2 text-xs">
                    {cat.color && <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />}
                    <span className="font-semibold text-foreground min-w-0 flex-1 truncate">{cat.name}</span>
                    {cat.dueDay && <span className="hidden sm:inline text-muted-foreground shrink-0">do {cat.dueDay}.</span>}
                    {note && <span className="hidden md:inline text-muted-foreground truncate max-w-[180px]" title={note}>📝 {note}</span>}
                    {summary.hasMoney && <span className="text-muted-foreground shrink-0">{amount > 0 ? money(amount) : '—'}</span>}
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0 ${statusClass(status)}`}>{paymentStatusLabel(status, names)}</span>
                    {dueState === 'overdue' && <span className="text-[10px] font-bold text-destructive shrink-0">zaległe</span>}
                    {dueState === 'today' && <span className="text-[10px] font-bold text-orange-400 shrink-0">dziś</span>}
                    {dueState === 'soon' && <span className="text-[10px] font-bold text-yellow-400 shrink-0">wkrótce</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
