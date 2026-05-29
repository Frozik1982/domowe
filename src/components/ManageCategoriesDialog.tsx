import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pencil, Trash2, Plus, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { type Category, type CellData, type CellStatus, type AssignedTo } from '@/hooks/useExpenseStore';
import CategoryDialog from '@/components/CategoryDialog';
import { toast } from 'sonner';

const MONTHS_SHORT = ['Maj','Cze','Lip','Sie','Wrz','Paź','Lis','Gru','Sty','Lut','Mar','Kwi'];
const BADGE: Record<AssignedTo, string> = { 'M': 'badge-m', 'J': 'badge-j', 'M+J': 'badge-mj' };
const STATUS_LABEL: Record<CellStatus, string> = {
  'unpaid': '—', 'paid-M': 'M✓', 'paid-J': 'J✓', 'paid-MJ': '✓', 'not-required': '·',
};
const STATUS_BADGE: Partial<Record<CellStatus, string>> = {
  'paid-M': 'badge-m', 'paid-J': 'badge-j', 'paid-MJ': 'badge-mj',
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  cells: CellData[];
  onAdd: (cat: Omit<Category, 'id'>) => void;
  onUpdate: (id: string, updates: Partial<Omit<Category, 'id'>>) => void;
  onDelete: (id: string) => void;
  onResetCell: (categoryId: string, monthIndex: number) => void;
  onClearAll: () => void;
  onSetNote: (categoryId: string, monthIndex: number, note: string) => void;
}

export default function ManageCategoriesDialog({
  open, onOpenChange, categories, cells,
  onAdd, onUpdate, onDelete, onResetCell, onClearAll, onSetNote,
}: Props) {
  const [editCat, setEditCat]               = useState<Category | null>(null);
  const [addOpen, setAddOpen]               = useState(false);
  const [deleteCatId, setDeleteCatId]       = useState<string | null>(null);
  const [expandedCatId, setExpandedCatId]   = useState<string | null>(null);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [resetInput, setResetInput]         = useState('');

  const deleteName = categories.find(c => c.id === deleteCatId)?.name ?? '';

  function getCellData(categoryId: string, monthIndex: number) {
    return cells.find(c => c.categoryId === categoryId && c.monthIndex === monthIndex);
  }
  function getStatus(categoryId: string, monthIndex: number): CellStatus {
    return getCellData(categoryId, monthIndex)?.status ?? 'unpaid';
  }
  function getNote(categoryId: string, monthIndex: number): string {
    return getCellData(categoryId, monthIndex)?.note ?? '';
  }

  function handleClearConfirm() {
    onClearAll();
    setClearDialogOpen(false);
    setResetInput('');
    toast.success('Historia płatności wyczyszczona');
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
          <div className="px-6 pt-6 pb-4 border-b border-border">
            <DialogHeader>
              <DialogTitle className="text-base">📋 Zarządzaj kategoriami</DialogTitle>
              <DialogDescription className="text-xs mt-1">
                Rozwiń kategorię, aby zresetować miesiące lub dodać notatki do płatności.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
            {categories.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <p className="text-3xl mb-2">📭</p>
                <p className="text-sm font-medium">Brak kategorii</p>
              </div>
            ) : categories.map(cat => {
              const isExpanded = expandedCatId === cat.id;
              return (
                <div key={cat.id} className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="flex items-center gap-2 p-3">
                    <button className="flex-1 flex items-center gap-2 text-left min-w-0"
                      onClick={() => setExpandedCatId(isExpanded ? null : cat.id)}>
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                  : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                      {cat.color && (
                        <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0 border border-border/20" style={{ backgroundColor: cat.color }} />
                      )}
                      <span className="font-semibold text-sm text-foreground truncate">{cat.name}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${BADGE[cat.assignedTo]}`}>{cat.assignedTo}</span>
                      {cat.dueDay && <span className="text-[10px] text-muted-foreground shrink-0">📅 {cat.dueDay}.</span>}
                      {cat.amount > 0 && <span className="text-xs text-muted-foreground shrink-0">{cat.amount.toLocaleString('pl-PL')} zł</span>}
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="outline" size="sm" className="h-7 px-2.5 gap-1 text-xs" onClick={() => setEditCat(cat)}>
                        <Pencil className="h-3 w-3" /> Edytuj
                      </Button>
                      <Button variant="outline" size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                        onClick={() => setDeleteCatId(cat.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-border/40 bg-muted/20 px-3 pt-2 pb-3">
                      <p className="text-[10px] text-muted-foreground mb-2 font-medium flex items-center gap-1">
                        <RotateCcw className="h-2.5 w-2.5" /> Resetuj miesiące · 📝 Dodaj notatki
                      </p>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                        {MONTHS_SHORT.map((m, mi) => {
                          const st  = getStatus(cat.id, mi);
                          const hasData = st !== 'unpaid';
                          const badgeCls = STATUS_BADGE[st];
                          const note = getNote(cat.id, mi);
                          return (
                            <div key={mi} className={`rounded-lg border p-1.5 flex flex-col gap-1 transition-colors ${
                              hasData ? 'border-border bg-card' : 'border-transparent bg-muted/30'
                            }`}>
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-medium text-foreground">{m}</span>
                                {hasData ? (
                                  <div className="flex items-center gap-0.5">
                                    <span className={`font-bold px-1 rounded text-[9px] ${badgeCls ?? 'text-muted-foreground'}`}>
                                      {STATUS_LABEL[st]}
                                    </span>
                                    <button
                                      onClick={() => { onResetCell(cat.id, mi); toast.success(`${cat.name} – ${m} zresetowano`); }}
                                      className="text-muted-foreground hover:text-destructive transition-colors"
                                      title={`Resetuj ${cat.name} – ${m}`}
                                    >
                                      <RotateCcw className="h-2.5 w-2.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground/30 text-[9px]">—</span>
                                )}
                              </div>
                              <input
                                type="text"
                                maxLength={60}
                                placeholder="notatka…"
                                value={note}
                                onChange={e => onSetNote(cat.id, mi, e.target.value)}
                                className="text-[9px] bg-transparent border-b border-border/30 outline-none w-full pb-0.5 text-muted-foreground placeholder:text-muted-foreground/30 focus:border-primary/50"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="px-4 py-4 border-t border-border bg-muted/20 space-y-2">
            <Button variant="outline"
              className="w-full gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30 text-sm"
              onClick={() => setClearDialogOpen(true)}>
              <Trash2 className="h-4 w-4" /> Wyczyść całą historię płatności
            </Button>
            <Button className="w-full gap-2" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> Dodaj nową kategorię
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <CategoryDialog open={!!editCat} onOpenChange={o => { if (!o) setEditCat(null); }}
        initialData={editCat ?? undefined}
        onSave={cat => { if (editCat) onUpdate(editCat.id, cat); setEditCat(null); }} />
      <CategoryDialog open={addOpen} onOpenChange={setAddOpen}
        onSave={cat => { onAdd(cat); setAddOpen(false); }} />

      <AlertDialog open={!!deleteCatId} onOpenChange={o => { if (!o) setDeleteCatId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usuń kategorię „{deleteName}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Spowoduje to <strong>bezpowrotne usunięcie całej historii płatności</strong> dla tej kategorii.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteCatId) { onDelete(deleteCatId); setDeleteCatId(null); } }}>
              Tak, usuń permanentnie
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={clearDialogOpen} onOpenChange={o => { if (!o) { setClearDialogOpen(false); setResetInput(''); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-4 w-4" /> Wyczyść całą historię
            </DialogTitle>
            <DialogDescription>
              Bezpowrotnie usuwa statusy i notatki wszystkich komórek. Nie można cofnąć.
            </DialogDescription>
          </DialogHeader>
          <div className="py-1 space-y-2">
            <p className="text-xs font-medium text-foreground">Wpisz <strong className="text-destructive">RESET</strong> aby potwierdzić:</p>
            <Input value={resetInput} onChange={e => setResetInput(e.target.value)} placeholder="RESET" autoFocus />
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="outline" size="sm" onClick={() => { setClearDialogOpen(false); setResetInput(''); }}>Anuluj</Button>
            <Button variant="destructive" size="sm" disabled={resetInput !== 'RESET'} onClick={handleClearConfirm}>
              Wyczyść wszystko
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
