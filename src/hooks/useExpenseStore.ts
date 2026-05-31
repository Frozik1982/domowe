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
  group?: string;            // optional group name used to organize categories
  deletedAt?: string;        // ISO timestamp when moved to trash
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
  history?: HistoryEntry[];
}

export interface HistoryEntry {
  id: string;
  at: string;
  label: string;
}

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'czynsz',   name: 'Czynsz',      group: 'Dom', amount: 0, assignedTo: 'M+J' },
  { id: 'prad',     name: 'Prąd',        group: 'Dom', amount: 0, assignedTo: 'M+J' },
  { id: 'upc',      name: 'UPC',         group: 'Dom', amount: 0, assignedTo: 'M+J' },
  { id: 'oneplus',  name: 'One Plus',    group: 'Elektronika', amount: 0, assignedTo: 'M' },
  { id: 'tvtcl',    name: 'TV TCL',      group: 'Elektronika', amount: 0, assignedTo: 'M+J' },
  { id: 'termomix', name: 'Termomix',    group: 'Raty', amount: 0, assignedTo: 'M+J' },
  { id: 'drukarka', name: 'Drukarka 3D', group: 'Elektronika', amount: 0, assignedTo: 'M' },
  { id: 'procesor', name: 'Procesor',    group: 'Elektronika', amount: 0, assignedTo: 'M' },
  { id: 'lodowka',  name: 'Lodówka',     group: 'Raty', amount: 0, assignedTo: 'M+J' },
  { id: 'tablet',   name: 'Tablet',      group: 'Elektronika', amount: 0, assignedTo: 'J' },
  { id: 'airfryer', name: 'Air Fryer',   group: 'Raty', amount: 0, assignedTo: 'M+J' },
  { id: 'xiaomi',   name: 'Xiaomi',      group: 'Elektronika', amount: 0, assignedTo: 'M' },
  { id: 'zegarek',  name: 'Zegarek',     group: 'Elektronika', amount: 0, assignedTo: 'J' },
];

const STORAGE_KEY = 'expense-tracker-v1';

function getCurrentFiscalYear(): number {
  const now = new Date();
  return now.getMonth() >= 4 ? now.getFullYear() : now.getFullYear() - 1;
}

function clampToCurrentFiscalYear(year: number): number {
  return Math.max(year, getCurrentFiscalYear());
}

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
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object' && typeof parsed.year === 'number') {
        return { ...parsed, year: clampToCurrentFiscalYear(parsed.year) };
      }
    }
  } catch { /* ignore */ }
  const year = getCurrentFiscalYear();
  return { year, categories: DEFAULT_CATEGORIES, cells: [], hiddenMonths: [], visiblePastMonths: [], autoHidePastMonths: true, history: [] };
}

export function useExpenseStore() {
  // ── Hook 1: State ──────────────────────────────────────────────────────────
  const [data, setData] = useState<StoreData>(getInitialData);
  const [undoStack, setUndoStack] = useState<StoreData[]>([]);

  // ── Hook 2: Effect ─────────────────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  function commitData(updater: (prev: StoreData) => StoreData, label = 'Zmiana danych') {
    setData(prev => {
      const next = updater(prev);
      if (next !== prev) {
        setUndoStack(stack => [prev, ...stack].slice(0, 50));
        const entry: HistoryEntry = { id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, at: new Date().toISOString(), label };
        return { ...next, history: [entry, ...(next.history ?? prev.history ?? [])].slice(0, 50) };
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
      }, 'Zmieniono status płatności');
    },
    []
  );

  const copyPreviousMonth = useCallback((monthIndex: number) => {
    if (monthIndex === 0) return;
    commitData(prev => {
      const prevCells  = prev.cells.filter(c => c.monthIndex === monthIndex - 1);
      const otherCells = prev.cells.filter(c => c.monthIndex !== monthIndex);
      return { ...prev, cells: [...otherCells, ...prevCells.map(c => ({ ...c, monthIndex }))] };
    }, 'Skopiowano poprzedni miesiąc');
  }, []);

  const addCategory = useCallback(
    (cat: Omit<Category, 'id'>) =>
      commitData(prev => ({
        ...prev,
        categories: [...prev.categories, { ...cat, id: `cat-${Date.now()}` }],
      }), 'Dodano kategorię'),
    []
  );

  const updateCategory = useCallback(
    (id: string, updates: Partial<Omit<Category, 'id'>>) =>
      commitData(prev => ({
        ...prev,
        categories: prev.categories.map(c => (c.id === id ? { ...c, ...updates } : c)),
      }), 'Zmieniono kategorię'),
    []
  );

  const deleteCategory = useCallback((id: string) =>
    commitData(prev => ({
      ...prev,
      categories: prev.categories.map(c => c.id === id ? { ...c, deletedAt: new Date().toISOString() } : c),
    }), 'Przeniesiono kategorię do kosza'), []);

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
    }, 'Ustawiono status płatności');
  }

  function setYear(year: number) {
    commitData(prev => ({ ...prev, year: clampToCurrentFiscalYear(year) }), 'Zmieniono rok');
  }

  function clearAllCells() {
    commitData(prev => ({ ...prev, cells: [] }), 'Wyczyszczono historię płatności');
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
    }, 'Zmieniono notatkę płatności');
  }

  function restoreCategory(id: string) {
    commitData(prev => ({
      ...prev,
      categories: prev.categories.map(c => c.id === id ? { ...c, deletedAt: undefined } : c),
    }), 'Przywrócono kategorię z kosza');
  }

  function permanentlyDeleteCategory(id: string) {
    commitData(prev => ({
      ...prev,
      categories: prev.categories.filter(c => c.id !== id),
      cells: prev.cells.filter(c => c.categoryId !== id),
    }), 'Usunięto kategorię na stałe');
  }

  function createNextYearFromCurrent() {
    commitData(prev => ({
      ...prev,
      year: prev.year + 1,
      categories: prev.categories.filter(c => !c.deletedAt).map(c => ({ ...c, deletedAt: undefined })),
      cells: [],
      hiddenMonths: [],
      visiblePastMonths: [],
      autoHidePastMonths: true,
    }), `Utworzono rok ${data.year + 1}/${String(data.year + 2).slice(2)}`);
  }

  function clearHistoryLog() {
    setData(prev => ({ ...prev, history: [] }));
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
    }, 'Zmieniono widoczność miesiąca');
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
    }, 'Ukryto minione miesiące');
  }

  function showAllMonths() {
    commitData(prev => ({
      ...prev,
      hiddenMonths: [],
      visiblePastMonths: Array.from({ length: 12 }, (_, i) => i),
    }), 'Pokazano wszystkie miesiące');
  }

  function setAutoHidePastMonths(enabled: boolean) {
    commitData(prev => ({ ...prev, autoHidePastMonths: enabled }), 'Zmieniono auto-ukrywanie miesięcy');
  }



  function replaceData(nextData: StoreData) {
    setData({
      ...nextData,
      year: clampToCurrentFiscalYear(nextData.year),
      hiddenMonths: normalizeMonthList(nextData.hiddenMonths),
      visiblePastMonths: normalizeMonthList(nextData.visiblePastMonths),
      autoHidePastMonths: nextData.autoHidePastMonths ?? true,
      history: Array.isArray(nextData.history) ? nextData.history.slice(0, 50) : [],
    });
    setUndoStack([]);
  }

  const activeData: StoreData = { ...data, categories: data.categories.filter(c => !c.deletedAt) };
  const trashCategories = data.categories.filter(c => !!c.deletedAt);

  return {
    data: activeData,
    rawData: data,
    replaceData,
    trashCategories,
    getStatus,
    cycleStatus,
    setStatus,
    copyPreviousMonth,
    addCategory,
    updateCategory,
    deleteCategory,
    restoreCategory,
    permanentlyDeleteCategory,
    createNextYearFromCurrent,
    clearHistoryLog,
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
    history: data.history ?? [],
  };
}
