import { useMemo, useState } from 'react';
import { type Category, type CellStatus, type AssignedTo, type CellData } from '@/hooks/useExpenseStore';
import { type FilterType } from '@/types';
import { Check, Copy, Eye, EyeOff, Lock, Pencil, X } from 'lucide-react';
import CellEditPopover from '@/components/CellEditPopover';

export interface TableStore {
  data: { year: number; categories: Category[]; cells: CellData[]; hiddenMonths?: number[]; autoHidePastMonths?: boolean }; 
  getStatus: (categoryId: string, monthIndex: number) => CellStatus;
  setStatus: (categoryId: string, monthIndex: number, status: CellStatus) => void;
  cycleStatus: (categoryId: string, monthIndex: number, assignedTo: AssignedTo) => void;
  copyPreviousMonth: (monthIndex: number) => void;
  toggleMonthHidden: (monthIndex: number, hidden?: boolean) => void;
  hidePastMonths: () => void;
  showAllMonths: () => void;
  setAutoHidePastMonths: (enabled: boolean) => void;
  updateCategory?: (id: string, updates: Partial<Omit<Category, 'id'>>) => void;
  setNote?: (categoryId: string, monthIndex: number, note: string) => void;
}

interface Props {
  store: TableStore;
  filter: FilterType;
  editMode: boolean;
  hideAmounts?: boolean;
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

function cellClass(status: CellStatus, isColHover: boolean, isExactHover: boolean, editMode: boolean, isViewOnly: boolean, dueClass?: string): string {
  const parts = ['expense-cell', 'border-l', 'border-border/30', 'py-2', 'text-center', 'select-none', 'relative'];

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

  if (dueClass) parts.push(dueClass);
  if (isColHover) parts.push('col-hover');
  if (isExactHover) parts.push('cell-exact-hover');
  return parts.join(' ');
}


function getDueClass(cat: Category, mi: number, status: CellStatus, currentMonth: number | null): string | undefined {
  if (!cat.dueDay || status !== 'unpaid' || currentMonth !== mi) return undefined;
  const daysLeft = cat.dueDay - new Date().getDate();
  if (daysLeft < 0) return 'cell-overdue';
  if (daysLeft === 0) return 'cell-due-today';
  if (daysLeft <= 5) return 'cell-due-soon';
  return undefined;
}

function getCurrentMonthIndex(year: number): number | null {
  const now = new Date(); const y = now.getFullYear(), m = now.getMonth();
  if (y === year && m >= 4) return m - 4;
  if (y === year + 1 && m <= 3) return m + 8;
  return null;
}

const MONTH_COL_W = 130;
const CAT_COL_MIN = 80;

export default function ExpenseTable({ store, filter, editMode, hideAmounts = false }: Props) {
  const { data, getStatus, setStatus, copyPreviousMonth, toggleMonthHidden, hidePastMonths, showAllMonths, setAutoHidePastMonths, updateCategory } = store;
  const [hover, setHover] = useState<{ row: number; col: string } | null>(null);
  const [menu, setMenu] = useState<{ cat: Category; mi: number; status: CellStatus; rect: DOMRect } | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; original: string; value: string } | null>(null);

  const cats = useMemo(() => [...data.categories].sort((a, b) => `${a.group || 'Bez grupy'}:${a.name}`.localeCompare(`${b.group || 'Bez grupy'}:${b.name}`, 'pl')), [data.categories]);
  const currentMonth = useMemo(() => getCurrentMonthIndex(data.year), [data.year]);
  const hiddenMonths = useMemo(() => new Set(data.hiddenMonths ?? []), [data.hiddenMonths]);
  const visibleMonthIndexes = useMemo(() => MONTHS.map((_, i) => i).filter(i => !hiddenMonths.has(i)), [hiddenMonths]);
  const isViewOnly = filter === 'all' && !editMode;

  function handleCellClick(e: React.MouseEvent<HTMLTableCellElement>, cat: Category, mi: number, status: CellStatus) {
    if (editMode) {
      if (status !== 'unpaid') setStatus(cat.id, mi, 'unpaid');
      return;
    }
    // Fast mode: if M/J/M+J filter is selected, unpaid cells are marked immediately.
    // Otherwise, open a compact menu with all options.
    if (filter !== 'all' && status === 'unpaid') {
      setStatus(cat.id, mi, smartPaidStatus(filter));
      return;
    }
    setMenu({ cat, mi, status, rect: e.currentTarget.getBoundingClientRect() });
  }

  function startRenameCategory(cat: Category) {
    if (!updateCategory) return;
    setRenaming({ id: cat.id, original: cat.name, value: cat.name });
  }

  function cancelRenameCategory() {
    setRenaming(null);
  }

  function saveRenameCategory() {
    if (!renaming || !updateCategory) return;
    const nextName = renaming.value.trim().replace(/\s+/g, ' ');
    // Safety: never save an empty name. If the field was cleared by accident,
    // cancel the edit and keep the previous category name.
    if (!nextName) {
      setRenaming(null);
      return;
    }
    if (nextName === renaming.original) {
      setRenaming(null);
      return;
    }
    updateCategory(renaming.id, { name: nextName });
    setRenaming(null);
  }

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden print:shadow-none print:border print:border-gray-300 print:rounded-none">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-border/70 bg-muted/20 print:hidden">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground">Widok miesięcy</span>
          {(data.hiddenMonths?.length ?? 0) > 0 ? (
            <span>Ukryte: {MONTHS.map((m, i) => hiddenMonths.has(i) ? m : null).filter(Boolean).join(', ')}</span>
          ) : (
            <span>Wszystkie miesiące widoczne</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground px-2 py-1 rounded-lg border border-border/70 bg-card/60">
            <input
              type="checkbox"
              checked={data.autoHidePastMonths !== false}
              onChange={e => setAutoHidePastMonths(e.currentTarget.checked)}
              className="accent-primary"
            />
            Auto-ukrywanie minionych
          </label>
          <button onClick={hidePastMonths} className="text-[11px] px-2 py-1 rounded-lg border border-border hover:bg-muted transition-colors">
            Ukryj minione
          </button>
          <button onClick={showAllMonths} className="text-[11px] px-2 py-1 rounded-lg border border-border hover:bg-muted transition-colors">
            Pokaż wszystkie
          </button>
        </div>
      </div>

      {(data.hiddenMonths?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-1.5 px-3 py-2 border-b border-border/50 bg-background/30 print:hidden">
          {MONTHS.map((month, mi) => hiddenMonths.has(mi) ? (
            <button
              key={month}
              onClick={() => toggleMonthHidden(mi, false)}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border border-border bg-card hover:bg-muted transition-colors text-muted-foreground"
              title={`Pokaż miesiąc: ${month}`}
            >
              <Eye className="h-3 w-3" /> {month}
            </button>
          ) : null)}
        </div>
      )}

      <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 240px)' }}>
        <table className="border-collapse text-sm w-full table-fixed">

          <colgroup>
            <col style={{ width: MONTH_COL_W, minWidth: MONTH_COL_W }} />
            {cats.map(cat => <col key={cat.id} style={{ minWidth: CAT_COL_MIN }} />)}
          </colgroup>

          {/* ── Header ── */}
          <thead className="sticky top-0 z-30 table-sticky-head">
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
                    className={`relative overflow-visible bg-muted/95 backdrop-blur-sm border-b border-l border-border py-3 px-2 text-center transition-colors ${isHovCol ? 'bg-primary/10 header-col-hover' : ''} print:bg-gray-100`}
                  >
                    {renaming?.id === cat.id ? (
                      <div className="relative h-8 print:hidden">
                        <div
                          className="absolute left-1/2 top-1/2 z-50 flex w-[230px] -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-xl border border-primary/35 bg-popover/95 p-1 shadow-xl backdrop-blur"
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <input
                            autoFocus
                            value={renaming.value}
                            onFocus={(e) => e.currentTarget.select()}
                            onChange={(e) => setRenaming(r => r ? { ...r, value: e.currentTarget.value } : r)}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              if (e.key === 'Enter') saveRenameCategory();
                              if (e.key === 'Escape') cancelRenameCategory();
                            }}
                            className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 text-left text-xs font-semibold text-foreground caret-primary outline-none placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/25"
                            placeholder="Nazwa kategorii"
                            aria-label={`Nowa nazwa kategorii ${cat.name}`}
                          />
                          <button
                            type="button"
                            onClick={saveRenameCategory}
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                            title="Zapisz nazwę"
                            aria-label="Zapisz nazwę"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={cancelRenameCategory}
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground"
                            title="Anuluj zmianę"
                            aria-label="Anuluj zmianę"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); startRenameCategory(cat); }}
                        className="mx-auto min-w-0 max-w-full text-[11px] font-semibold text-foreground leading-tight flex items-center justify-center gap-1 truncate rounded-md px-1 py-0.5 hover:bg-primary/10 hover:text-primary transition-colors group/name print:pointer-events-none"
                        title={`Kliknij, żeby szybko zmienić nazwę: ${cat.name}`}
                      >
                        {cat.color && (
                          <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                        )}
                        <span className="truncate">{cat.name}</span>
                        {updateCategory && <Pencil className="h-3 w-3 opacity-0 group-hover/name:opacity-60 shrink-0 transition-opacity print:hidden" />}
                      </button>
                    )}
                    {cat.group && (
                      <span className="text-[8px] text-primary/80 block mt-0.5 truncate">{cat.group}</span>
                    )}
                    {cat.amount > 0 && (
                      <span className="text-[9px] text-muted-foreground block mt-0.5">
                        {hideAmounts ? '••• zł' : `${cat.amount.toLocaleString('pl-PL')} zł`}
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
            {visibleMonthIndexes.map((mi) => {
              const month = MONTHS[mi];
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
                      ? 'row-hover'
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
                      <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-70 hover:!opacity-100 print:hidden transition-opacity">
                        {mi > 0 && (
                          <button onClick={() => copyPreviousMonth(mi)}
                            className="p-0.5 rounded hover:bg-muted"
                            title="Skopiuj statusy z poprzedniego miesiąca">
                            <Copy className="h-3 w-3 text-muted-foreground" />
                          </button>
                        )}
                        <button onClick={() => toggleMonthHidden(mi, true)}
                          className="p-0.5 rounded hover:bg-muted"
                          title={`Ukryj miesiąc: ${month}`}>
                          <EyeOff className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </div>
                    </div>
                  </td>

                  {/* Payment cells */}
                  {cats.map(cat => {
                    const status   = getStatus(cat.id, mi);
                    const isPaid   = PAID.has(status);
                    const showLock = isPaid && !editMode;
                    const isColHov = hover?.col === cat.id;
                    const isExact  = isColHov && hover?.row === mi;
                    const dueClass = getDueClass(cat, mi, status, currentMonth);
                    return (
                      <td key={cat.id}
                        className={cellClass(status, isColHov, isExact, editMode, isViewOnly, dueClass)}
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
                            : dueClass === 'cell-overdue'
                            ? `${cat.name} – ${month} · Termin minął (${cat.dueDay}. dzień miesiąca)`
                            : dueClass === 'cell-due-today'
                            ? `${cat.name} – ${month} · Termin płatności dziś`
                            : dueClass === 'cell-due-soon'
                            ? `${cat.name} – ${month} · Termin płatności wkrótce (${cat.dueDay}. dzień miesiąca)`
                            : `${cat.name} – ${month} · Kliknij aby oznaczyć jako opłacone`
                        }
                      >
                        <span className="text-xs flex items-center justify-center gap-0.5 w-full">
                          {CELL_LABEL[status]}
                          {dueClass && <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full due-dot" />}
                          {showLock && <Lock className="h-2 w-2 opacity-20 shrink-0" />}
                          {(() => { const n = data.cells.find(c => c.categoryId === cat.id && c.monthIndex === mi)?.note; return n ? <span className="w-1 h-1 rounded-full bg-primary/50 shrink-0" title={n} /> : null; })()}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {visibleMonthIndexes.length === 0 && (
              <tr>
                <td colSpan={cats.length + 1} className="py-8 text-center text-sm text-muted-foreground">
                  Wszystkie miesiące są ukryte. Kliknij „Pokaż wszystkie”, żeby przywrócić tabelę.
                </td>
              </tr>
            )}
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
      {menu && (
        <CellEditPopover
          catName={menu.cat.name}
          month={MONTHS[menu.mi]}
          status={menu.status}
          assignedTo={menu.cat.assignedTo}
          anchorRect={menu.rect}
          onClose={() => setMenu(null)}
          onSet={(status) => setStatus(menu.cat.id, menu.mi, status)}
        />
      )}
    </div>
  );
}
