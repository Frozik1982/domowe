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
  return { year, categories: DEFAULT_CATEGORIES, cells: [] };
}

export function useExpenseStore() {
  // ── Hook 1: State ──────────────────────────────────────────────────────────
  const [data, setData] = useState<StoreData>(getInitialData);

  // ── Hook 2: Effect ─────────────────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  // ── Hooks 3–8: Callbacks (exactly 6 — count is stable, do not add/remove) ──
  const getStatus = useCallback(
    (categoryId: string, monthIndex: number): CellStatus =>
      data.cells.find(c => c.categoryId === categoryId && c.monthIndex === monthIndex)?.status ?? 'unpaid',
    [data.cells]
  );

  const cycleStatus = useCallback(
    (categoryId: string, monthIndex: number, assignedTo: AssignedTo) => {
      setData(prev => {
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
    setData(prev => {
      const prevCells  = prev.cells.filter(c => c.monthIndex === monthIndex - 1);
      const otherCells = prev.cells.filter(c => c.monthIndex !== monthIndex);
      return { ...prev, cells: [...otherCells, ...prevCells.map(c => ({ ...c, monthIndex }))] };
    });
  }, []);

  const addCategory = useCallback(
    (cat: Omit<Category, 'id'>) =>
      setData(prev => ({
        ...prev,
        categories: [...prev.categories, { ...cat, id: `cat-${Date.now()}` }],
      })),
    []
  );

  const updateCategory = useCallback(
    (id: string, updates: Partial<Omit<Category, 'id'>>) =>
      setData(prev => ({
        ...prev,
        categories: prev.categories.map(c => (c.id === id ? { ...c, ...updates } : c)),
      })),
    []
  );

  const deleteCategory = useCallback((id: string) =>
    setData(prev => ({
      ...prev,
      categories: prev.categories.filter(c => c.id !== id),
      cells:      prev.cells.filter(c => c.categoryId !== id),
    })), []);

  // ── Plain functions (not hooks — count above must stay at 6 useCallbacks) ──

  /** Set status, preserving any existing note on the cell */
  function setStatus(categoryId: string, monthIndex: number, status: CellStatus) {
    setData(prev => {
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
    setData(prev => ({ ...prev, year }));
  }

  function clearAllCells() {
    setData(prev => ({ ...prev, cells: [] }));
  }

  function getNote(categoryId: string, monthIndex: number): string {
    return data.cells.find(c => c.categoryId === categoryId && c.monthIndex === monthIndex)?.note ?? '';
  }

  function setNote(categoryId: string, monthIndex: number, note: string) {
    setData(prev => {
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
  };
}
