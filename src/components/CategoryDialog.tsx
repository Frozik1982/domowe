import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { type Category, type AssignedTo } from '@/hooks/useExpenseStore';
import { X, CreditCard, CalendarIcon } from 'lucide-react';
import { format, addMonths, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';

const COLOR_PALETTE = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#22c55e', '#10b981', '#14b8a6', '#3b82f6',
  '#6366f1', '#8b5cf6', '#a855f7', '#ec4899',
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Category;
  onSave: (cat: Omit<Category, 'id'>) => void;
}

export default function CategoryDialog({ open, onOpenChange, initialData, onSave }: Props) {
  const [name, setName]                     = useState('');
  const [amount, setAmount]                 = useState('');
  const [assignedTo, setAssignedTo]         = useState<AssignedTo>('M+J');
  const [dueDay, setDueDay]                 = useState('');
  const [color, setColor]                   = useState<string | undefined>(undefined);
  const [isInstallment, setIsInstallment]   = useState(false);
  const [installmentMonths, setInstallmentMonths] = useState('');
  const [installmentStartDate, setInstallmentStartDate] = useState<Date | undefined>(undefined);
  const [calendarOpen, setCalendarOpen]     = useState(false);

  useEffect(() => {
    if (open) {
      setName(initialData?.name ?? '');
      setAmount(initialData?.amount ? String(initialData.amount) : '');
      setAssignedTo(initialData?.assignedTo ?? 'M+J');
      setDueDay(initialData?.dueDay ? String(initialData.dueDay) : '');
      setColor(initialData?.color);
      const hasInstallment = !!initialData?.installmentMonths;
      setIsInstallment(hasInstallment);
      setInstallmentMonths(hasInstallment ? String(initialData!.installmentMonths) : '');
      setInstallmentStartDate(
        initialData?.installmentStartDate ? parseISO(initialData.installmentStartDate) : undefined
      );
      setCalendarOpen(false);
    }
  }, [open, initialData]);

  function handleSave() {
    if (!name.trim()) return;
    const dueDayNum = parseInt(dueDay);
    const installNum = parseInt(installmentMonths);
    onSave({
      name: name.trim(),
      amount: parseFloat(amount) || 0,
      assignedTo,
      dueDay: !isNaN(dueDayNum) && dueDayNum >= 1 && dueDayNum <= 28 ? dueDayNum : undefined,
      color: color || undefined,
      installmentMonths: isInstallment && !isNaN(installNum) && installNum > 0 ? installNum : undefined,
      installmentStartDate: isInstallment && installmentStartDate
        ? installmentStartDate.toISOString().slice(0, 10)
        : undefined,
    });
  }

  const monthlyAmt = parseFloat(amount) || 0;
  const installNum = parseInt(installmentMonths) || 0;
  const totalAmt = monthlyAmt * installNum;

  const endDate = useMemo(() => {
    if (!installmentStartDate || installNum <= 0) return null;
    return addMonths(installmentStartDate, installNum);
  }, [installmentStartDate, installNum]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialData ? 'Edytuj kategorię' : 'Dodaj kategorię'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="cat-name">Nazwa</Label>
            <Input
              id="cat-name"
              placeholder="np. Czynsz, Prąd, Lodówka…"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              autoFocus
            />
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label htmlFor="cat-amount">Kwota miesięczna (zł) — opcjonalne</Label>
            <Input
              id="cat-amount"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
          </div>

          {/* Assignee + Due day */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Płatnik</Label>
              <Select value={assignedTo} onValueChange={v => setAssignedTo(v as AssignedTo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">M — tylko M</SelectItem>
                  <SelectItem value="J">J — tylko J</SelectItem>
                  <SelectItem value="M+J">M+J — wspólne</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-dueday">Termin (dzień 1–28)</Label>
              <Input
                id="cat-dueday"
                type="number" min="1" max="28"
                placeholder="np. 10"
                value={dueDay}
                onChange={e => setDueDay(e.target.value)}
              />
            </div>
          </div>

          {dueDay && parseInt(dueDay) >= 1 && parseInt(dueDay) <= 28 && (
            <p className="text-xs text-muted-foreground -mt-1">
              📅 Płatność wymagana do {dueDay}. dnia każdego miesiąca
            </p>
          )}

          {/* ── Installment section ── */}
          <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Płatność ratalna</p>
                  <p className="text-xs text-muted-foreground">Znasz łączną liczbę rat do spłaty</p>
                </div>
              </div>
              <Switch
                checked={isInstallment}
                onCheckedChange={v => {
                  setIsInstallment(v);
                  if (!v) {
                    setInstallmentMonths('');
                    setInstallmentStartDate(undefined);
                  }
                }}
              />
            </div>

            {isInstallment && (
              <div className="space-y-3 pt-1 border-t border-border/50">
                {/* Number of installments */}
                <div className="space-y-1.5">
                  <Label htmlFor="cat-installments">Łączna liczba rat</Label>
                  <Input
                    id="cat-installments"
                    type="number"
                    min="2"
                    max="360"
                    placeholder="np. 24"
                    value={installmentMonths}
                    onChange={e => setInstallmentMonths(e.target.value)}
                  />
                </div>

                {/* Start date calendar */}
                <div className="space-y-1.5">
                  <Label>📅 Data rozpoczęcia rat</Label>
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal h-9 text-sm"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                        {installmentStartDate
                          ? format(installmentStartDate, 'd MMMM yyyy', { locale: pl })
                          : <span className="text-muted-foreground">Wybierz datę…</span>
                        }
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={installmentStartDate}
                        onSelect={(date) => {
                          setInstallmentStartDate(date);
                          setCalendarOpen(false);
                        }}
                        locale={pl}
                        fixedWeeks
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Summary info */}
                {installNum > 0 && (
                  <div className="bg-primary/8 rounded-lg px-3 py-2.5 space-y-1">
                    <p className="text-xs text-muted-foreground">
                      🗓️ Liczba rat: <span className="font-semibold text-foreground">
                        {installNum} miesięcy
                        {installNum >= 12 && ` (${(installNum/12).toFixed(1).replace('.0','')} lat)`}
                      </span>
                    </p>
                    {installmentStartDate && (
                      <p className="text-xs text-muted-foreground">
                        📆 Start: <span className="font-semibold text-foreground">
                          {format(installmentStartDate, 'd MMMM yyyy', { locale: pl })}
                        </span>
                      </p>
                    )}
                    {endDate && (
                      <p className="text-xs text-muted-foreground">
                        🏁 Koniec: <span className="font-semibold text-foreground">
                          {format(endDate, 'd MMMM yyyy', { locale: pl })}
                        </span>
                      </p>
                    )}
                    {totalAmt > 0 && (
                      <p className="text-xs text-muted-foreground">
                        💰 Wartość łączna: <span className="font-semibold text-foreground">
                          {totalAmt.toLocaleString('pl-PL')} zł
                        </span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Color picker */}
          <div className="space-y-2">
            <Label>Kolor kategorii — opcjonalne</Label>
            <div className="flex flex-wrap gap-2 items-center">
              {COLOR_PALETTE.map(c => (
                <button
                  key={c} type="button"
                  onClick={() => setColor(color === c ? undefined : c)}
                  className={`w-6 h-6 rounded-full border-2 transition-all hover:scale-110 ${
                    color === c ? 'border-foreground ring-2 ring-offset-1 ring-foreground/30 scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
              {color && (
                <button type="button" onClick={() => setColor(undefined)}
                  className="w-6 h-6 rounded-full border-2 border-border bg-muted flex items-center justify-center hover:bg-muted/80 transition-all">
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Anuluj</Button>
          <Button onClick={handleSave} disabled={!name.trim() || (isInstallment && !parseInt(installmentMonths))}>
            {initialData ? 'Zapisz zmiany' : 'Dodaj kategorię'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
