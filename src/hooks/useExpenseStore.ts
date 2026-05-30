import { useState, useEffect, useCallback } from 'react';

export type AssignedTo = 'M' | 'J' | 'M+J';
export type CellStatus = 'unpaid' | 'paid-M' | 'paid-J' | 'paid-MJ' | 'not-required';

export interface Category {
  id: string;
  name: string;
  amount: number;
  assignedTo: AssignedTo;
  dueDay?: number;           // day of month (1–28) when this bill is due
  color?: string;            // optional accent color (hex)
  installmentMonths?: number; // if set: total number of installments (rata)
  installmentStartDate?: string; // ISO date string: when installments started
}

export interface CellData {
  categoryId: string;
  monthIndex: number;
  status: CellStatus;
  note?: string; // optional payment note
}

export interface StoreData {
  year: number;
  categories: Category[];
  cells: CellData[];
  /** Months hidden in the main table (0 = Maj, 11 = Kwiecień) */
  hiddenMonths?: number[];
  /** Past months manually restored by the user even when auto-hide is enabled */
  visiblePastMonths?: number[];
  /** Auto-hide months that are before the current fiscal month */
  autoHidePastMonths?: boolean;
}

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'czynsz',   name: 'Czynsz',      amount: 0, assignedTo: 'M+J' },
  { id: 'prad',     name: 'Prąd',        amount: 0, assignedTo: 'M+J' },
  { id: 'upc',      name: 'UPC',         amount: 0, assignedTo: 'M+J' },
  { id: 'oneplus',  name: 'One Plus',    amount: 0, assignedTo: 'M' },
  { id: 'tvtcl',    name: 'TV TCL',      amount: 0, assignedTo: 'M+J' },
  { id: 'termomix', name: 'Termomix',    amount: 0, assignedTo: 'M+J' },
  { id: 'drukarka', name: 'Drukarka 3D', amount: 0, assignedTo: 'M' },
  { id: 'procesor', name: 'Procesor',    amount: 0, assignedTo: 'M' },
  { id: 'lodowka',  name: 'Lodówka',     amount: 0, assignedTo: 'M+J' },
  { id: 'tablet',   name: 'Tablet',      amount: 0, assignedTo: 'J' },
  { id: 'airfryer', name: 'Air Fryer',   amount: 0, assignedTo: 'M+J' },
  { id: 'xiaomi',   name: 'Xiaomi',      amount: 0, assignedTo: 'M' },
  { id: 'zegarek',  name: 'Zegarek',     amount: 0, assignedTo: 'J' },
];

const STORAGE_KEY = 'expense-tracker-v1';

function getCurrentMonthIndexForYear(year: number): number | null {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (y === year && m >= 4) return m - 4;
  if (y === year + 1 && m <= 3) return m + 8;
  return null;
}

function normalizeMonthList(values: number[] | undefined): number[] {
  return Array.from(new Set((values ?? []).filter(v => Number.isInteger(v) && v >= 0 && v < 12))).sort((a, b) => a - b);
}

function getNextStatus(current: CellStatus, assignedTo: AssignedTo): CellStatus {
  if (assignedTo === 'M') {
    const c: CellStatus[] = ['unpaid', 'paid-M', 'not-required'];
    return c[(c.indexOf(current) + 1) % c.length] ?? 'unpaid';
  }
  if (assignedTo === 'J') {
    const c: CellStatus[] = ['unpaid', 'paid-J', 'not-required'];
    return c[(c.indexOf(current) + 1) % c.length] ?? 'unpaid';
  }
  const c: CellStatus[] = ['unpaid', 'paid-M', 'paid-J', 'paid-MJ', 'not-required'];
  const idx = c.indexOf(current);
  return c[(idx === -1 ? 0 : idx + 1) % c.length];
}

function getInitialData(): StoreData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  const now = new Date();
  const year = now.getMonth() >= 4 ? now.getFullYear() : now.getFullYear() - 1;
  return { year, categories: DEFAULT_CATEGORIES, cells: [], hiddenMonths: [], visiblePastMonths: [], autoHidePastMonths: true };
}

export function useExpenseStore() {
  // ── Hook 1: State ──────────────────────────────────────────────────────────
  const [data, setData] = useState<StoreData>(getInitialData);
  const [undoStack, setUndoStack] = useState<StoreData[]>([]);

  // ── Hook 2: Effect ─────────────────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  function commitData(updater: (prev: StoreData) => StoreData) {
    setData(prev => {
      const next = updater(prev);
      if (next !== prev) {
        setUndoStack(stack => [prev, ...stack].slice(0, 25));
      }
      return next;
    });
  }

  function undoLastChange() {
    setUndoStack(stack => {
      const [last, ...rest] = stack;
      if (last) setData(last);
      return rest;
    });
  }

  // Auto-hide months that have already passed in the selected fiscal year.
  // Manual "show" choices are kept in visiblePastMonths.
  useEffect(() => {
    commitData(prev => {
      if (prev.autoHidePastMonths === false) return prev;
      const currentMonth = getCurrentMonthIndexForYear(prev.year);
      if (currentMonth === null || currentMonth <= 0) return prev;

      const hidden = new Set(normalizeMonthList(prev.hiddenMonths));
      const visiblePast = new Set(normalizeMonthList(prev.visiblePastMonths));
      let changed = false;

      for (let i = 0; i < currentMonth; i += 1) {
        if (!visiblePast.has(i) && !hidden.has(i)) {
          hidden.add(i);
          changed = true;
        }
      }

      if (!changed) return prev;
      return { ...prev, hiddenMonths: Array.from(hidden).sort((a, b) => a - b) };
    });
  }, [data.year]);

  // ── Hooks 3–8: Callbacks (exactly 6 — count is stable, do not add/remove) ──
  const getStatus = useCallback(
    (categoryId: string, monthIndex: number): CellStatus =>
      data.cells.find(c => c.categoryId === categoryId && c.monthIndex === monthIndex)?.status ?? 'unpaid',
    [data.cells]
  );

  const cycleStatus = useCallback(
    (categoryId: string, monthIndex: number, assignedTo: AssignedTo) => {
      commitData(prev => {
        const current =
          prev.cells.find(c => c.categoryId === categoryId && c.monthIndex === monthIndex)?.status ?? 'unpaid';
        const next = getNextStatus(current, assignedTo);
        const filtered = prev.cells.filter(
          c => !(c.categoryId === categoryId && c.monthIndex === monthIndex)
        );
        return { ...prev, cells: [...filtered, { categoryId, monthIndex, status: next }] };
      });
    },
    []
  );

  const copyPreviousMonth = useCallback((monthIndex: number) => {
    if (monthIndex === 0) return;
    commitData(prev => {
      const prevCells  = prev.cells.filter(c => c.monthIndex === monthIndex - 1);
      const otherCells = prev.cells.filter(c => c.monthIndex !== monthIndex);
      return { ...prev, cells: [...otherCells, ...prevCells.map(c => ({ ...c, monthIndex }))] };
    });
  }, []);

  const addCategory = useCallback(
    (cat: Omit<Category, 'id'>) =>
      commitData(prev => ({
        ...prev,
        categories: [...prev.categories, { ...cat, id: `cat-${Date.now()}` }],
      })),
    []
  );

  const updateCategory = useCallback(
    (id: string, updates: Partial<Omit<Category, 'id'>>) =>
      commitData(prev => ({
        ...prev,
        categories: prev.categories.map(c => (c.id === id ? { ...c, ...updates } : c)),
      })),
    []
  );

  const deleteCategory = useCallback((id: string) =>
    commitData(prev => ({
      ...prev,
      categories: prev.categories.filter(c => c.id !== id),
      cells:      prev.cells.filter(c => c.categoryId !== id),
    })), []);

  // ── Plain functions (not hooks — count above must stay at 6 useCallbacks) ──

  /** Set status, preserving any existing note on the cell */
  function setStatus(categoryId: string, monthIndex: number, status: CellStatus) {
    commitData(prev => {
      const existing = prev.cells.find(c => c.categoryId === categoryId && c.monthIndex === monthIndex);
      const filtered = prev.cells.filter(c => !(c.categoryId === categoryId && c.monthIndex === monthIndex));
      if (status === 'unpaid') {
        if (existing?.note) {
          return { ...prev, cells: [...filtered, { categoryId, monthIndex, status: 'unpaid', note: existing.note }] };
        }
        return { ...prev, cells: filtered };
      }
      return { ...prev, cells: [...filtered, { categoryId, monthIndex, status, note: existing?.note }] };
    });
  }

  function setYear(year: number) {
    commitData(prev => ({ ...prev, year }));
  }

  function clearAllCells() {
    commitData(prev => ({ ...prev, cells: [] }));
  }

  function getNote(categoryId: string, monthIndex: number): string {
    return data.cells.find(c => c.categoryId === categoryId && c.monthIndex === monthIndex)?.note ?? '';
  }

  function setNote(categoryId: string, monthIndex: number, note: string) {
    commitData(prev => {
      const existing = prev.cells.find(c => c.categoryId === categoryId && c.monthIndex === monthIndex);
      const filtered = prev.cells.filter(c => !(c.categoryId === categoryId && c.monthIndex === monthIndex));
      if (existing) {
        return { ...prev, cells: [...filtered, { ...existing, note: note || undefined }] };
      }
      if (note.trim()) {
        return { ...prev, cells: [...filtered, { categoryId, monthIndex, status: 'unpaid', note }] };
      }
      return prev;
    });
  }



  function toggleMonthHidden(monthIndex: number, hidden?: boolean) {
    if (monthIndex < 0 || monthIndex > 11) return;
    commitData(prev => {
      const hiddenMonths = new Set(normalizeMonthList(prev.hiddenMonths));
      const visiblePastMonths = new Set(normalizeMonthList(prev.visiblePastMonths));
      const shouldHide = hidden ?? !hiddenMonths.has(monthIndex);

      if (shouldHide) {
        hiddenMonths.add(monthIndex);
        visiblePastMonths.delete(monthIndex);
      } else {
        hiddenMonths.delete(monthIndex);
        visiblePastMonths.add(monthIndex);
      }

      return {
        ...prev,
        hiddenMonths: Array.from(hiddenMonths).sort((a, b) => a - b),
        visiblePastMonths: Array.from(visiblePastMonths).sort((a, b) => a - b),
      };
    });
  }

  function hidePastMonths() {
    commitData(prev => {
      const currentMonth = getCurrentMonthIndexForYear(prev.year);
      if (currentMonth === null || currentMonth <= 0) return prev;
      const hiddenMonths = new Set(normalizeMonthList(prev.hiddenMonths));
      for (let i = 0; i < currentMonth; i += 1) hiddenMonths.add(i);
      return {
        ...prev,
        hiddenMonths: Array.from(hiddenMonths).sort((a, b) => a - b),
        visiblePastMonths: [],
        autoHidePastMonths: true,
      };
    });
  }

  function showAllMonths() {
    commitData(prev => ({
      ...prev,
      hiddenMonths: [],
      visiblePastMonths: Array.from({ length: 12 }, (_, i) => i),
    }));
  }

  function setAutoHidePastMonths(enabled: boolean) {
    commitData(prev => ({ ...prev, autoHidePastMonths: enabled }));
  }


  return {
    data,
    getStatus,
    cycleStatus,
    setStatus,
    copyPreviousMonth,
    addCategory,
    updateCategory,
    deleteCategory,
    setYear,
    clearAllCells,
    getNote,
    setNote,
    toggleMonthHidden,
    hidePastMonths,
    showAllMonths,
    setAutoHidePastMonths,
    undoLastChange,
    canUndo: undoStack.length > 0,
  };
}
