import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Clock3 } from 'lucide-react';
import { type StoreData, type CellStatus } from '@/hooks/useExpenseStore';
import { usePayerNames, payerLabel } from '@/hooks/usePayerNames';

const MONTHS = ['Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień','Styczeń','Luty','Marzec','Kwiecień'];
const PAID = new Set<CellStatus>(['paid-M','paid-J','paid-MJ']);

interface Props { data: StoreData }

function monthDate(dataYear: number, monthIndex: number, dueDay: number): Date {
  const jsMonth = monthIndex < 8 ? monthIndex + 4 : monthIndex - 8;
  const year = monthIndex < 8 ? dataYear : dataYear + 1;
  return new Date(year, jsMonth, dueDay, 23, 59, 59);
}

function money(v: number): string {
  return `${v.toLocaleString('pl-PL', { maximumFractionDigits: 2 })} zł`;
}

export default function OverdueView({ data }: Props) {
  const { names } = usePayerNames();
  const [open, setOpen] = useState(false);
  const today = new Date();

  const items = useMemo(() => {
    return data.categories.flatMap(cat => {
      if (!cat.dueDay) return [];
      return Array.from({ length: 12 }, (_, monthIndex) => {
        const cell = data.cells.find(c => c.categoryId === cat.id && c.monthIndex === monthIndex);
        const status = cell?.status ?? 'unpaid';
        if (status === 'not-required' || PAID.has(status)) return null;
        const dueDate = monthDate(data.year, monthIndex, cat.dueDay!);
        const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / 86400000);
        if (diffDays > 5) return null;
        return { cat, monthIndex, status, dueDate, diffDays, note: cell?.note ?? '' };
      }).filter(Boolean);
    }).filter((x): x is NonNullable<typeof x> => !!x).sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }, [data, today]);

  const overdue = items.filter(i => i.diffDays < 0);
  const todayItems = items.filter(i => i.diffDays === 0);
  const soon = items.filter(i => i.diffDays > 0);

  if (items.length === 0) {
    return (
      <section className="rounded-2xl border border-border bg-card px-4 py-3 mb-4 shadow-sm print:hidden">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Clock3 className="h-4 w-4 text-green-400" /> Zaległości
          <span className="ml-auto rounded-full border border-green-500/20 bg-green-500/10 px-2.5 py-1 text-xs text-green-300">brak pilnych płatności</span>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-orange-500/25 bg-orange-500/[0.04] mb-4 shadow-sm overflow-hidden print:hidden">
      <button type="button" onClick={() => setOpen(v => !v)} className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-muted/20 transition-colors">
        <AlertTriangle className={`h-4 w-4 shrink-0 ${overdue.length ? 'text-red-400' : 'text-orange-300'}`} />
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-foreground">Zaległości i terminy</h2>
          <p className="text-[11px] text-muted-foreground">
            {overdue.length} zaległe · {todayItems.length} dziś · {soon.length} wkrótce
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {overdue.length > 0 && <span className="rounded-full bg-red-500/10 px-2 py-1 text-xs font-bold text-red-300">Zaległe: {overdue.length}</span>}
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-border/60 divide-y divide-border/40">
          {items.map(({ cat, monthIndex, diffDays, note }) => (
            <div key={`${cat.id}-${monthIndex}`} className="px-4 py-2.5 flex items-center gap-3 text-xs">
              {cat.color && <span className="h-2.5 w-2.5 rounded-full border border-border/30" style={{ backgroundColor: cat.color }} />}
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-foreground truncate">{cat.name}</div>
                <div className="text-muted-foreground truncate">{MONTHS[monthIndex]} · {payerLabel(cat.assignedTo, names)}{cat.amount > 0 ? ` · ${money(cat.amount)}` : ''}{note ? ` · ${note}` : ''}</div>
              </div>
              <span className={`shrink-0 rounded-full border px-2 py-1 font-bold ${diffDays < 0 ? 'border-red-500/30 bg-red-500/10 text-red-300' : diffDays === 0 ? 'border-orange-500/30 bg-orange-500/10 text-orange-300' : 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300'}`}>
                {diffDays < 0 ? `${Math.abs(diffDays)} dni po terminie` : diffDays === 0 ? 'termin dziś' : `za ${diffDays} dni`}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
