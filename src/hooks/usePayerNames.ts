import { useCallback, useEffect, useState } from 'react';
import { type CellStatus, type AssignedTo } from '@/hooks/useExpenseStore';

export interface PayerNames {
  m: string;
  j: string;
}

export const PAYER_NAMES_KEY = 'expense-payer-names-v1';
export const DEFAULT_PAYER_NAMES: PayerNames = { m: 'M', j: 'J' };

function clean(value: unknown, fallback: string): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

export function readPayerNames(): PayerNames {
  try {
    const raw = localStorage.getItem(PAYER_NAMES_KEY);
    if (!raw) return DEFAULT_PAYER_NAMES;
    const parsed = JSON.parse(raw) as Partial<PayerNames>;
    return {
      m: clean(parsed.m, DEFAULT_PAYER_NAMES.m),
      j: clean(parsed.j, DEFAULT_PAYER_NAMES.j),
    };
  } catch {
    return DEFAULT_PAYER_NAMES;
  }
}

export function payerLabel(value: AssignedTo | 'M' | 'J', names: PayerNames): string {
  if (value === 'M') return names.m;
  if (value === 'J') return names.j;
  return `${names.m}+${names.j}`;
}

export function payerShort(value: AssignedTo | 'M' | 'J', names: PayerNames): string {
  if (value === 'M') return names.m || 'M';
  if (value === 'J') return names.j || 'J';
  return `${names.m || 'M'}+${names.j || 'J'}`;
}

export function paymentStatusLabel(status: CellStatus, names: PayerNames): string {
  if (status === 'paid-M') return `${names.m} zapłaciła`;
  if (status === 'paid-J') return `${names.j} zapłacił`;
  if (status === 'paid-MJ') return 'Oboje zapłacili';
  if (status === 'not-required') return 'Niewymagane';
  return 'Do zapłaty';
}

export function paymentChipLabel(status: CellStatus, names: PayerNames): string {
  if (status === 'paid-M') return `${names.m} ✓`;
  if (status === 'paid-J') return `${names.j} ✓`;
  if (status === 'paid-MJ') return '✓';
  if (status === 'not-required') return '·';
  return '—';
}

export function usePayerNames() {
  const [names, setNamesState] = useState<PayerNames>(() => readPayerNames());

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === PAYER_NAMES_KEY) setNamesState(readPayerNames());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setNames = useCallback((next: PayerNames) => {
    const cleaned = {
      m: clean(next.m, DEFAULT_PAYER_NAMES.m).slice(0, 24),
      j: clean(next.j, DEFAULT_PAYER_NAMES.j).slice(0, 24),
    };
    localStorage.setItem(PAYER_NAMES_KEY, JSON.stringify(cleaned));
    setNamesState(cleaned);
  }, []);

  return { names, setNames };
}
