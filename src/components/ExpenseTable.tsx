import { useMemo, useState } from 'react';
import { type Category, type CellStatus, type AssignedTo, type CellData } from '@/hooks/useExpenseStore';
import { type FilterType } from '@/types';
import { Copy, Lock } from 'lucide-react';

export interface TableStore {
  data: { year: number; categories: Category[]; cells: CellData[] };
  getStatus: (categoryId: string, monthIndex: number) => CellStatus;
  setStatus: (categoryId: string, monthIndex: number, status: CellStatus) => void;
  cycleStatus: (categoryId: string, monthIndex: number, assignedTo: AssignedTo) => void;
  copyPreviousMonth: (monthIndex: number) => void;
}

interface Props {
  store: TableStore;
  filter: FilterType;
  editMode: boolean;
}

const MONTHS = ['Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień','Styczeń','Luty','Marzec','Kwiecień'];
const CELL_LABEL: Record<CellStatus, string> = {
  'unpaid':'—', 'paid-M':'M ✓', 'paid-J':'J ✓', 'paid-MJ':'✓', 'not-required':'·',
};
const PAID = new Set<CellStatus>(['paid-M','paid-J','paid-MJ']);

function smartPaidStatus(filter: FilterType): CellStatus {
  if (filter === 'M') return 'paid-M';
  if (filter === 'J') return 'paid-J';
  return 'paid-MJ';
}

function cellClass(status: CellStatus, isDimmed: boolean, editMode: boolean, isViewOnly: boolean): string {
  const parts = ['border-l', 'border-border/30', 'py-2', 'text-center', 'select-none'];

  const canErase = editMode && status !== 'unpaid';
  const canWrite = !editMode && !isViewOnly && status === 'unpaid';

  if (status === 'unpaid') {
    parts.push('st-unpaid');
    parts.push(canWrite ? 'st-unpaid-click cursor-pointer' : 'cursor-default');
  } else if (status === 'not-required') {
    parts.push('st-notreq');
    parts.push(canErase ? 'st-notreq-click cursor-pointer' : 'cursor-default');
  } else {
    parts.push('st-paid');
    if (status === 'paid-M')      parts.push('st-paid-m');
    else if (status === 'paid-J') parts.push('st-paid-j');
    else                          parts.push('st-paid-mj');
    parts.push(canErase ? 'st-paid-click cursor-pointer' : 'cursor-default');
  }

  if (isDimmed) parts.push('col-dim');
  return parts.join(' ');
}

function getCurrentMonthIndex(year: number): number | null {
  const now = new Date(); const y = now.getFullYear(), m = now.getMonth();
  if (y === year && m >= 4) return m - 4;
  if (y === year + 1 && m <= 3) return m + 8;
  return null;
}

const MONTH_COL_W = 130;
const CAT_COL_MIN = 80;

export default function ExpenseTable({ store, filter, editMode }: Props) {
  const { data, getStatus, setStatus, copyPreviousMonth } = store;
  const [hover, setHover] = useState<{ row: number; col: string } | null>(null);

  const cats = useMemo(() => data.categories, [data.categories]);
  const currentMonth = useMemo(() => getCurrentMonthIndex(data.year), [data.year]);
  const isViewOnly = filter === 'all' && !editMode;

  function handleCellClick(_e: React.MouseEvent<HTMLTableCellElement>, cat: Category, mi: number, status: CellStatus) {
    if (editMode) {
      if (status !== 'unpaid') setStatus(cat.id, mi, 'unpaid');
      return;
    }
    if (filter === 'all') return;
    if (status === 'unpaid') setStatus(cat.id, mi, smartPaidStatus(filter));
  }

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden print:shadow-none print:border print:border-gray-300 print:rounded-none">
      <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 240px)' }}>
        <table className="border-collapse text-sm w-full table-fixed">

          <colgroup>
            <col style={{ width: MONTH_COL_W, minWidth: MONTH_COL_W }} />
            {cats.map(cat => <col key={cat.id} style={{ minWidth: CAT_COL_MIN }} />)}
          </colgroup>

          {/* ── Header ── */}
          <thead className="sticky top-0 z-20">
            <tr>
              <th className="sticky left-0 z-30 bg-muted/95 backdrop-blur-sm text-left py-3 px-3 text-xs font-semibold text-muted-foreground border-b border-r border-border whitespace-nowrap print:bg-gray-100">
                Miesiąc
              </th>
              {cats.map(cat => {
                const isHovCol = hover?.col === cat.id;
                return (
                  <th key={cat.id}
                    onMouseEnter={() => setHover(h => ({ row: h?.row ?? -1, col: cat.id }))}
                    onMouseLeave={() => setHover(null)}
                    style={cat.color ? { borderTop: `3px solid ${cat.color}` } : {}}
                    className={`bg-muted/95 backdrop-blur-sm border-b border-l border-border py-3 px-2 text-center transition-colors ${isHovCol ? 'bg-primary/5' : ''} print:bg-gray-100`}
                  >
                    <span className="text-[11px] font-semibold text-foreground leading-tight flex items-center justify-center gap-1 truncate" title={cat.name}>
                      {cat.color && (
                        <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      )}
                      <span className="truncate">{cat.name}</span>
                    </span>
                    {cat.amount > 0 && (
                      <span className="text-[9px] text-muted-foreground block mt-0.5">
                        {cat.amount.toLocaleString('pl-PL')} zł
                      </span>
                    )}
                    {cat.installmentMonths && (() => {
                      const paidN = data.cells.filter(c => c.categoryId === cat.id && PAID.has(c.status)).length;
                      const total = cat.installmentMonths;
                      const done  = paidN >= total;
                      const pct   = Math.min(100, Math.round((paidN / total) * 100));
                      return (
                        <div className="mt-1 w-full px-1">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className={`text-[8px] font-bold ${done ? 'text-chart-3' : 'text-primary'}`}>
                              {done ? '✓ spłacone' : `${paidN}/${total} rat`}
                            </span>
                            <span className="text-[8px] text-muted-foreground">{pct}%</span>
                          </div>
                          <div className="h-1 rounded-full bg-border overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${pct}%`,
                                background: done ? `hsl(var(--chart-3))` : `hsl(var(--chart-4))`,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })()}
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* ── Body ── */}
          <tbody>
            {MONTHS.map((month, mi) => {
              const isCurrent = mi === currentMonth;
              const isHovRow  = hover?.row === mi;
              // Subtle alternating stripes — barely visible, aids reading
              const isOdd     = mi % 2 === 1;
              return (
                <tr key={mi}
                  className={`group border-b border-border/50 last:border-0 transition-colors ${
                    isCurrent
                      ? 'bg-row-current'
                      : isHovRow
                      ? 'bg-muted/25'
                      : isOdd
                      ? 'bg-muted/10'
                      : ''
                  }`}
                >
                  {/* Month label */}
                  <td className={`sticky left-0 z-10 py-2.5 px-3 text-xs font-medium border-r border-border/50 whitespace-nowrap transition-colors ${
                    isCurrent
                      ? 'bg-current-month-label text-primary font-semibold print:bg-gray-50'
                      : isOdd
                      ? 'bg-muted/10 text-foreground print:bg-white'
                      : 'bg-card text-foreground print:bg-white'
                  }`}>
                    <div className="flex items-center gap-1.5">
                      <span>{month}</span>
                      {isCurrent && (
                        <span className="text-[9px] bg-primary/15 text-primary rounded-md px-1.5 py-0.5 font-semibold print:hidden">
                          teraz
                        </span>
                      )}
                      {mi > 0 && (
                        <button onClick={() => copyPreviousMonth(mi)}
                          className="ml-auto opacity-0 group-hover:opacity-50 hover:!opacity-100 print:hidden transition-opacity p-0.5 rounded hover:bg-muted"
                          title="Skopiuj statusy z poprzedniego miesiąca">
                          <Copy className="h-3 w-3 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                  </td>

                  {/* Payment cells */}
                  {cats.map(cat => {
                    const status   = getStatus(cat.id, mi);
                    const isPaid   = PAID.has(status);
                    const showLock = isPaid && !editMode;
                    const isColHov = hover?.col === cat.id;
                    const isExact  = isColHov && hover?.row === mi;
                    return (
                      <td key={cat.id}
                        className={cellClass(status, isColHov && !isExact, editMode, isViewOnly)}
                        onClick={e => handleCellClick(e, cat, mi, status)}
                        onMouseEnter={() => setHover({ row: mi, col: cat.id })}
                        onMouseLeave={() => setHover(null)}
                        title={
                          editMode
                            ? status !== 'unpaid'
                              ? `${cat.name} – ${month} · Kliknij aby wyczyścić (tryb gumki)`
                              : `${cat.name} – ${month} · Puste — wyłącz tryb edycji aby pisać`
                            : filter === 'all'
                            ? `${cat.name} – ${month} · Wybierz M, J lub M+J aby rejestrować płatności`
                            : isPaid
                            ? `${cat.name} – ${month} · Zablokowane — włącz Edycję aktywną aby wyczyścić`
                            : `${cat.name} – ${month} · Kliknij aby oznaczyć jako opłacone`
                        }
                      >
                        <span className="text-xs flex items-center justify-center gap-0.5 w-full">
                          {CELL_LABEL[status]}
                          {showLock && <Lock className="h-2 w-2 opacity-20 shrink-0" />}
                          {(() => { const n = data.cells.find(c => c.categoryId === cat.id && c.monthIndex === mi)?.note; return n ? <span className="w-1 h-1 rounded-full bg-primary/50 shrink-0" title={n} /> : null; })()}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>

          {/* ── Footer: column totals ── */}
          <tfoot className="sticky bottom-0 z-20">
            <tr className="bg-muted/90 backdrop-blur-sm border-t border-border print:bg-gray-100">
              <td className="sticky left-0 z-10 bg-muted/90 py-2 px-3 text-[10px] font-bold text-muted-foreground border-r border-border print:bg-gray-100">
                Suma
              </td>
              {cats.map(cat => {
                const paid = Array.from({length:12}, (_,i) => getStatus(cat.id,i)).filter(s => PAID.has(s)).length;
                const req  = Array.from({length:12}, (_,i) => getStatus(cat.id,i)).filter(s => s !== 'not-required').length;
                return (
                  <td key={cat.id} className="border-l border-border/30 py-2 text-center">
                    <span className={`text-[10px] font-semibold ${paid === req && req > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                      {paid}/{req}
                    </span>
                  </td>
                );
              })}
            </tr>
          </tfoot>

        </table>
      </div>
    </div>
  );
}
