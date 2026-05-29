import { useMemo, useState } from 'react';
import { type Category, type CellStatus, type AssignedTo } from '@/hooks/useExpenseStore';
import { type FilterType } from '@/types';
import { type TableStore } from '@/components/ExpenseTable';
import { ChevronLeft, ChevronRight, Lock, Eye, Eraser } from 'lucide-react';

const MONTHS = ['Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień','Styczeń','Luty','Marzec','Kwiecień'];
const PAID   = new Set<CellStatus>(['paid-M','paid-J','paid-MJ']);

interface Props { store: TableStore; filter: FilterType; editMode: boolean; year: number }

const BADGE_CLASS: Record<AssignedTo, string> = { 'M': 'badge-m', 'J': 'badge-j', 'M+J': 'badge-mj' };

const STATUS_LABEL: Record<CellStatus, string> = {
  'unpaid':       'Do opłacenia',
  'paid-M':       'M zapłacił ✓',
  'paid-J':       'J zapłaciła ✓',
  'paid-MJ':      'Oboje ✓',
  'not-required': 'Niewymagane',
};

/** Returns the paid status to write based on the active filter ("pen colour") */
function smartPaidStatus(filter: FilterType): CellStatus {
  if (filter === 'M') return 'paid-M';
  if (filter === 'J') return 'paid-J';
  return 'paid-MJ';
}

function statusBtnClass(status: CellStatus, editMode: boolean, isViewOnly: boolean): string {
  const base = 'min-w-[130px] py-2.5 px-3 rounded-xl text-xs font-semibold transition-all';
  const canErase = editMode && status !== 'unpaid';
  const canWrite = !editMode && !isViewOnly && status === 'unpaid';
  const clickable = canErase || canWrite;
  const ia  = clickable ? 'active:scale-95' : '';
  const cur = clickable ? 'cursor-pointer' : 'cursor-default';
  if (status === 'unpaid')       return `${base} ${ia} ${cur} st-unpaid ${canWrite ? 'st-unpaid-click' : ''}`;
  if (status === 'not-required') return `${base} ${ia} ${cur} st-notreq ${canErase ? 'st-notreq-click' : ''}`;
  return `${base} ${ia} ${cur} st-paid ${
    status === 'paid-M' ? 'st-paid-m' : status === 'paid-J' ? 'st-paid-j' : 'st-paid-mj'
  } ${canErase ? 'st-paid-click' : ''}`;
}

function getCurrentMonthIdx(year: number): number {
  const now = new Date(); const y = now.getFullYear(), m = now.getMonth();
  if (y === year && m >= 4) return m - 4;
  if (y === year + 1 && m <= 3) return m + 8;
  return 0;
}

export default function MobileMonthView({ store, filter, editMode, year }: Props) {
  const [monthIdx, setMonthIdx] = useState(() => getCurrentMonthIdx(year));
  const { data, getStatus, setStatus } = store;

  // ── Rule 1: always show ALL categories regardless of filter ──
  const cats = useMemo(() => data.categories, [data.categories]);

  const monthYear = monthIdx <= 7 ? year : year + 1;
  const isCurrent = monthIdx === getCurrentMonthIdx(year);
  const paidCount = cats.filter(c => PAID.has(getStatus(c.id, monthIdx))).length;
  const totalReq  = cats.filter(c => getStatus(c.id, monthIdx) !== 'not-required').length;

  // "Wszystkie" in normal (non-edit) mode = view only
  const isViewOnly = filter === 'all' && !editMode;

  function handleBtnClick(_e: React.MouseEvent<HTMLButtonElement>, cat: Category, status: CellStatus) {
    // ── Rule 2: edit mode = eraser ──
    if (editMode) {
      if (status !== 'unpaid') setStatus(cat.id, monthIdx, 'unpaid');
      return;
    }
    if (filter === 'all') return;
    if (status === 'unpaid') setStatus(cat.id, monthIdx, smartPaidStatus(filter));
  }

  return (
    <div className="sm:hidden space-y-3">
      {/* Month navigation */}
      <div className="bg-card rounded-2xl border border-border shadow-sm p-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setMonthIdx(i => Math.max(0, i - 1))} disabled={monthIdx === 0}
            className="p-2 rounded-xl hover:bg-muted disabled:opacity-25 transition-colors active:scale-95">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2">
              <span className="text-lg font-bold text-foreground">{MONTHS[monthIdx]}</span>
              {isCurrent && <span className="text-[9px] bg-primary text-primary-foreground rounded px-1.5 py-0.5 font-semibold">teraz</span>}
            </div>
            <div className="text-xs text-muted-foreground">{monthYear}</div>
            <div className="mt-1.5 text-xs font-medium">
              {editMode
                ? <span className="text-destructive flex items-center justify-center gap-1">
                    <Eraser className="h-3 w-3" /> Tryb gumki — kliknij aby wyczyścić
                  </span>
                : isViewOnly
                ? <span className="text-muted-foreground flex items-center justify-center gap-1">
                    <Eye className="h-3 w-3" /> Tryb podglądu
                  </span>
                : <>
                    <span className="text-green-600 dark:text-green-400">{paidCount} opłacone</span>
                    {totalReq - paidCount > 0 && <span className="text-destructive ml-2">{totalReq - paidCount} pozostałe</span>}
                  </>
              }
            </div>
          </div>
          <button onClick={() => setMonthIdx(i => Math.min(11, i + 1))} disabled={monthIdx === 11}
            className="p-2 rounded-xl hover:bg-muted disabled:opacity-25 transition-colors active:scale-95">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Category list */}
      <div className="space-y-2">
        {cats.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm bg-card rounded-2xl border border-border">
            Brak kategorii — dodaj je w panelu Zarządzaj kategoriami
          </div>
        ) : cats.map(cat => {
          const status   = getStatus(cat.id, monthIdx);
          const isPaid   = PAID.has(status);
          const showLock = isPaid && !editMode;
          return (
            <div key={cat.id} className="bg-card rounded-2xl border border-border shadow-sm px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {cat.color && (
                    <span className="inline-block w-3 h-3 rounded-full shrink-0 border border-border/30" style={{ backgroundColor: cat.color }} />
                  )}
                  <span className="font-semibold text-sm text-foreground">{cat.name}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${BADGE_CLASS[cat.assignedTo]}`}>{cat.assignedTo}</span>
                </div>
                {cat.amount > 0 && <span className="text-xs text-muted-foreground">{cat.amount.toLocaleString('pl-PL')} zł/mies.</span>}
                {cat.installmentMonths && (() => {
                  const paidN = data.cells.filter(c => c.categoryId === cat.id && PAID.has(c.status)).length;
                  const total = cat.installmentMonths;
                  const done  = paidN >= total;
                  const pct   = Math.min(100, Math.round((paidN / total) * 100));
                  return (
                    <div className="w-full mt-1 space-y-0.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className={done ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-primary font-semibold'}>
                          {done ? '✓ Spłacono' : `${paidN}/${total} rat`}
                        </span>
                        <span className="text-muted-foreground">{pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${done ? 'bg-green-500' : 'bg-primary'}`}
                          style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })()}
              </div>
              <button
                onClick={e => handleBtnClick(e, cat, status)}
                className={statusBtnClass(status, editMode, isViewOnly)}
                title={
                  editMode
                    ? status !== 'unpaid' ? 'Kliknij aby wyczyścić (tryb gumki)' : 'Puste — wyłącz tryb edycji aby pisać'
                    : filter === 'all' ? 'Tryb podglądu — wybierz M, J lub M+J aby rejestrować'
                    : isPaid ? 'Włącz Edycję aktywną aby wyczyścić'
                    : 'Kliknij aby oznaczyć jako opłacone'
                }
              >
                <span className="flex items-center justify-center gap-1">
                  {STATUS_LABEL[status]}
                  {showLock && <Lock className="h-3 w-3 opacity-40 shrink-0" />}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
