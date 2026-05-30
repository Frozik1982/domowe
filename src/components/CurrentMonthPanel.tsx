import { useMemo } from 'react';
import { AlertTriangle, CalendarDays, CheckCircle2, CircleDollarSign, Clock3, MinusCircle, ReceiptText, Scale } from 'lucide-react';
import { type CellStatus, type Category, type StoreData } from '@/hooks/useExpenseStore';

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

function statusLabel(status: CellStatus): string {
  if (status === 'paid-M') return 'M zapłacił';
  if (status === 'paid-J') return 'J zapłaciła';
  if (status === 'paid-MJ') return 'Oboje';
  if (status === 'not-required') return 'Niewymagane';
  return 'Do zapłaty';
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

    const items = data.categories.map(cat => {
      const status = getStatus(data, cat.id, currentMonthIndex);
      const required = status !== 'not-required';
      const isPaid = PAID.has(status);
      const amount = cat.amount || 0;
      const dueState = getDueState(data.year, currentMonthIndex, cat, status);

      if (required) {
        requiredCount += 1;
        total += amount;
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

      return { cat, status, amount, required, isPaid, dueState };
    });

    const remaining = Math.max(0, total - paid);
    const net = jOwesM - mOwesJ;
    const alerts = items.filter(i => ['overdue', 'today', 'soon'].includes(i.dueState));

    return { total, paid, remaining, requiredCount, paidCount, paidByM, paidByJ, net, alerts, items };
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
      <div className="px-4 py-3 border-b border-border/70 bg-muted/20 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 mr-auto">
          <CalendarDays className="h-4 w-4 text-primary" />
          <div>
            <h2 className="text-sm font-bold text-foreground">Ten miesiąc — {monthName}</h2>
            <p className="text-[11px] text-muted-foreground">Szybki przegląd kwot, terminów i rozliczenia M/J</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xl font-black text-foreground leading-none">{pct}%</div>
          <div className="text-[10px] text-muted-foreground">{summary.paidCount}/{summary.requiredCount} opłacone</div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
          <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground"><CircleDollarSign className="h-3.5 w-3.5" /> Razem</div>
            <div className="text-lg font-bold text-foreground mt-1">{money(summary.total)}</div>
          </div>
          <div className="rounded-xl border border-border/70 bg-green-500/5 p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5" /> Opłacone</div>
            <div className="text-lg font-bold text-green-400 mt-1">{money(summary.paid)}</div>
          </div>
          <div className="rounded-xl border border-border/70 bg-orange-500/5 p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground"><Clock3 className="h-3.5 w-3.5" /> Pozostało</div>
            <div className="text-lg font-bold text-orange-400 mt-1">{money(summary.remaining)}</div>
          </div>
          <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground"><ReceiptText className="h-3.5 w-3.5" /> M / J zapłacili</div>
            <div className="text-sm font-bold text-foreground mt-1"><span className="text-blue-300">M {money(summary.paidByM)}</span><br /><span className="text-violet-300">J {money(summary.paidByJ)}</span></div>
          </div>
          <div className="rounded-xl border border-border/70 bg-primary/5 p-3 col-span-2 lg:col-span-1">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground"><Scale className="h-3.5 w-3.5" /> Do wyrównania</div>
            <div className="text-sm font-bold text-foreground mt-1">
              {summary.net === 0 ? 'Wyrównane' : summary.net > 0 ? `J → M ${money(summary.net)}` : `M → J ${money(Math.abs(summary.net))}`}
            </div>
          </div>
        </div>

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
          <div className="divide-y divide-border/50 max-h-64 overflow-auto category-scroll">
            {summary.items.map(({ cat, status, amount, dueState }) => (
              <div key={cat.id} className="px-3 py-2.5 flex items-center gap-2 text-xs">
                {cat.color && <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />}
                <span className="font-semibold text-foreground min-w-0 flex-1 truncate">{cat.name}</span>
                {cat.dueDay && <span className="hidden sm:inline text-muted-foreground shrink-0">do {cat.dueDay}.</span>}
                <span className="text-muted-foreground shrink-0">{amount > 0 ? money(amount) : '—'}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0 ${statusClass(status)}`}>{statusLabel(status)}</span>
                {dueState === 'overdue' && <span className="text-[10px] font-bold text-destructive shrink-0">zaległe</span>}
                {dueState === 'today' && <span className="text-[10px] font-bold text-orange-400 shrink-0">dziś</span>}
                {dueState === 'soon' && <span className="text-[10px] font-bold text-yellow-400 shrink-0">wkrótce</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
