import { useState, useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useExpenseStore } from '@/hooks/useExpenseStore';
import { useDarkMode } from '@/hooks/useDarkMode';
import { usePayerNames } from '@/hooks/usePayerNames';
import PinGate, { useLogout } from '@/components/PinGate';
import ExpenseTable from '@/components/ExpenseTable';
import MobileMonthView from '@/components/MobileMonthView';
import SummaryCards from '@/components/SummaryCards';
import CurrentMonthPanel from '@/components/CurrentMonthPanel';
import OverdueView from '@/components/OverdueView';
import SettingsDialog from '@/components/SettingsDialog';
import ChartsSection from '@/components/ChartsSection';
import ManageCategoriesDialog from '@/components/ManageCategoriesDialog';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Printer, Settings, BarChart2, List, Lock, Unlock, HelpCircle, LogOut, Undo2, Eye, EyeOff, CalendarPlus, History } from 'lucide-react';
import InstallPrompt from '@/components/InstallPrompt';
import PdfExportDialog from '@/components/PdfExportDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { type FilterType } from '@/types';

const STORAGE_KEY = 'expense-tracker-v1';

function monthYear(dataYear: number, monthIndex: number): string {
  const months = ['Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień','Styczeń','Luty','Marzec','Kwiecień'];
  return `${months[monthIndex]} ${monthIndex < 8 ? dataYear : dataYear + 1}`;
}

function statusExportLabel(status: string, names: { m: string; j: string }): string {
  if (status === 'paid-M') return `${names.m} zapłaciła`;
  if (status === 'paid-J') return `${names.j} zapłacił`;
  if (status === 'paid-MJ') return 'Oboje zapłacili';
  if (status === 'not-required') return 'Niewymagane';
  return 'Do zapłaty';
}

function buildExportRows(data: ReturnType<typeof useExpenseStore>['data'], names: { m: string; j: string }) {
  return data.categories.flatMap(cat => Array.from({ length: 12 }, (_, monthIndex) => {
    const cell = data.cells.find(c => c.categoryId === cat.id && c.monthIndex === monthIndex);
    const status = cell?.status ?? 'unpaid';
    return {
      Rok: `${data.year}/${String(data.year + 1).slice(2)}`,
      Miesiac: monthYear(data.year, monthIndex),
      Kategoria: cat.name,
      Platnik: cat.assignedTo === 'M' ? names.m : cat.assignedTo === 'J' ? names.j : `${names.m}+${names.j}`,
      Kwota: Number(cat.amount || 0),
      Termin: cat.dueDay ? `${cat.dueDay}. dzień miesiąca` : '',
      Status: statusExportLabel(status, names),
      Notatka: cell?.note ?? '',
    };
  }));
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return '\ufeff' + [headers.map(esc).join(';'), ...rows.map(row => headers.map(h => esc(row[h])).join(';'))].join('\n');
}

function buildExcelHtml(rows: Record<string, unknown>[], title: string): string {
  const headers = rows[0] ? Object.keys(rows[0]) : [];
  const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title></head><body><h2>${esc(title)}</h2><table border="1"><thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${headers.map(h => `<td>${esc(row[h])}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`;
}

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

// ── Inner component — renders INSIDE PinGate so useLogout() has access to context ──
function AppContent() {
  const { logout } = useLogout();          // ✅ now inside PinGate Provider
  useDarkMode();
  const store = useExpenseStore();
  const { names } = usePayerNames();

  const filters: { label: string; value: FilterType }[] = [
    { label: 'Wszystkie', value: 'all' },
    { label: names.m, value: 'M' },
    { label: names.j, value: 'J' },
    { label: `${names.m}+${names.j}`, value: 'M+J' },
  ];

  const [filter, setFilter]                 = useState<FilterType>('all');
  const [manageCatsOpen, setManageCatsOpen] = useState(false);
  const [editMode, setEditMode]             = useState(false);
  const [settingsOpen, setSettingsOpen]     = useState(false);
  const [showCharts, setShowCharts]         = useState(false);
  const [pdfOpen, setPdfOpen]               = useState(false);
  const [hideAmounts, setHideAmounts]       = useState(() => localStorage.getItem('expense-hide-amounts') === 'true');
  const [historyOpen, setHistoryOpen]       = useState(false);

  useEffect(() => {
    localStorage.setItem('expense-hide-amounts', String(hideAmounts));
  }, [hideAmounts]);

  const handleExport = useCallback(() => {
    const raw  = localStorage.getItem(STORAGE_KEY) ?? '{}';
    const blob = new Blob([raw], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), {
      href: url,
      download: `platnosci-backup-${new Date().toISOString().slice(0, 10)}.json`,
    });
    a.click();
    URL.revokeObjectURL(url);
    localStorage.setItem('expense-last-backup-date', new Date().toISOString());
    toast.success('Backup JSON wyeksportowany');
  }, []);

  const handleImport = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.categories) || !Array.isArray(parsed.cells) || typeof parsed.year !== 'number') {
          throw new Error('Invalid backup shape');
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        toast.success('Dane zaimportowane — odświeżam stronę…');
        setTimeout(() => window.location.reload(), 800);
      } catch {
        toast.error('Nieprawidłowy plik backupu');
      }
    };
    reader.readAsText(file);
  }, []);


  const handleExportCsv = useCallback(() => {
    const rows = buildExportRows(store.data, names);
    const csv = toCsv(rows);
    downloadFile(csv, `platnosci-${store.data.year}-${store.data.year + 1}.csv`, 'text/csv;charset=utf-8');
    toast.success('CSV wyeksportowany');
  }, [store.data, names]);

  const handleExportExcel = useCallback(() => {
    const rows = buildExportRows(store.data, names);
    const html = buildExcelHtml(rows, `Płatności ${store.data.year}/${String(store.data.year + 1).slice(2)}`);
    downloadFile(html, `platnosci-${store.data.year}-${store.data.year + 1}.xls`, 'application/vnd.ms-excel;charset=utf-8');
    toast.success('Plik Excel wyeksportowany');
  }, [store.data, names]);

  const { data, setYear, addCategory, updateCategory, deleteCategory, restoreCategory, permanentlyDeleteCategory, createNextYearFromCurrent, clearHistoryLog, setStatus, clearAllCells, setNote, undoLastChange, canUndo, history } = store;
  const startYear = data.year;
  const endYear   = data.year + 1;

  return (
    <div className="min-h-screen bg-background print:bg-white">

      {/* ── Top bar ── */}
      <header className="bg-card/90 backdrop-blur-md border-b border-border shadow-sm sticky top-0 z-20 print:hidden">
        <div className="header-accent-strip" />
        <div className="container mx-auto px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-2">

            {/* Logo + year nav */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-xl select-none">💳</span>
              <h1 className="text-sm font-bold text-foreground hidden sm:block">Płatności domowe</h1>
              <div className="flex items-center gap-0.5 ml-1">
                <button onClick={() => setYear(startYear - 1)} className="p-1.5 hover:bg-muted rounded-lg transition-colors"><ChevronLeft className="h-3.5 w-3.5" /></button>
                <span className="text-sm font-semibold bg-muted px-2.5 py-1 rounded-lg">{startYear}/{String(endYear).slice(2)}</span>
                <button onClick={() => setYear(startYear + 1)} className="p-1.5 hover:bg-muted rounded-lg transition-colors"><ChevronRight className="h-3.5 w-3.5" /></button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="flex gap-0.5 bg-muted rounded-lg p-0.5">
                {filters.map(f => (
                  <button key={f.value} onClick={() => setFilter(f.value)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${filter === f.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                    {f.label}
                  </button>
                ))}
              </div>

              <Button
                variant="outline" size="sm"
                className="h-7 px-2 gap-1 text-xs"
                disabled={!canUndo}
                onClick={() => { undoLastChange(); toast.success('Cofnięto ostatnią zmianę'); }}
                title={canUndo ? 'Cofnij ostatnią zmianę' : 'Brak zmian do cofnięcia'}
              >
                <Undo2 className="h-3.5 w-3.5" /><span className="hidden lg:inline">Cofnij</span>
              </Button>

              <Button
                variant="outline" size="sm"
                className="h-7 px-2 gap-1 text-xs"
                onClick={() => setHistoryOpen(true)}
                title="Pokaż historię zmian"
              >
                <History className="h-3.5 w-3.5" /><span className="hidden lg:inline">Historia</span>
              </Button>

              <Button
                variant="outline" size="sm"
                className="h-7 px-2 gap-1 text-xs"
                onClick={() => {
                  if (confirm(`Utworzyć nowy rok ${data.year + 1}/${String(data.year + 2).slice(2)} na podstawie obecnego?

Kategorie, kwoty, terminy i grupy zostaną skopiowane, a płatności wyczyszczone.`)) {
                    createNextYearFromCurrent();
                    toast.success('Utworzono nowy rok rozliczeniowy');
                  }
                }}
                title="Utwórz kolejny rok na podstawie obecnego"
              >
                <CalendarPlus className="h-3.5 w-3.5" /><span className="hidden lg:inline">Nowy rok</span>
              </Button>

              <Button
                variant={hideAmounts ? 'secondary' : 'outline'} size="sm"
                className="h-7 px-2 gap-1 text-xs"
                onClick={() => setHideAmounts(v => !v)}
                title={hideAmounts ? 'Pokaż kwoty' : 'Ukryj kwoty'}
              >
                {hideAmounts ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                <span className="hidden lg:inline">{hideAmounts ? 'Pokaż kwoty' : 'Ukryj kwoty'}</span>
              </Button>

              <Button variant="outline" size="sm" className="h-7 px-2 gap-1 text-xs" onClick={() => setManageCatsOpen(true)}
                title="Zarządzaj kategoriami rachunków">
                <List className="h-3.5 w-3.5" /><span className="hidden sm:inline">Kategorie</span>
              </Button>

              <Button
                variant={editMode ? 'destructive' : 'outline'}
                size="sm" className="h-7 px-2 gap-1 text-xs"
                onClick={() => setEditMode(v => !v)}
                title={editMode ? 'Zablokuj historię' : 'Odblokuj opłacone komórki'}
              >
                {editMode
                  ? <><Unlock className="h-3.5 w-3.5" /><span className="hidden sm:inline">Edycja aktywna</span></>
                  : <><Lock    className="h-3.5 w-3.5" /><span className="hidden sm:inline">Historia</span></>
                }
              </Button>

              <Button variant="outline" size="sm" className="h-7 px-2 gap-1 text-xs" onClick={() => setPdfOpen(true)}>
                <Printer className="h-3.5 w-3.5" /><span className="hidden sm:inline">PDF</span>
              </Button>
              <Button variant="outline" size="sm" className={`h-7 px-2 gap-1 text-xs ${showCharts ? 'bg-muted' : ''}`}
                onClick={() => setShowCharts(v => !v)}>
                <BarChart2 className="h-3.5 w-3.5" /><span className="hidden sm:inline">Dashboard</span>
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setSettingsOpen(true)} title="Ustawienia">
                <Settings className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost" size="sm"
                className="h-7 w-7 p-0 hover:text-destructive hover:bg-destructive/10 transition-colors"
                onClick={logout}
                title="Zablokuj aplikację (wymagany PIN przy następnym wejściu)"
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Edit-mode warning banner (animated) ── */}
      <AnimatePresence>
        {editMode && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="overflow-hidden print:hidden"
          >
            <div className="bg-destructive/10 border-b border-destructive/30 px-4 py-1.5 text-xs text-destructive font-medium flex items-center justify-center gap-2">
              <Unlock className="h-3 w-3 shrink-0" />
              Tryb edycji historii aktywny — opłacone komórki są odblokowane
              <button onClick={() => setEditMode(false)} className="underline ml-1 hover:no-underline">Wyłącz</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Print header ── */}
      <div className="hidden print:block px-4 py-3 border-b border-gray-300">
        <h1 className="text-base font-bold">Zestawienie płatności {startYear}/{String(endYear).slice(2)}</h1>
        <p className="text-[10px] text-gray-500 mt-0.5">M✓ / J✓ = kto zapłacił/a · ✓ = oboje · — = do opłacenia · · = niewymagane</p>
      </div>

      {/* ── Main content ── */}
      <main className="container mx-auto px-3 sm:px-4 py-4 print:p-2 print:max-w-none">
        <div className="print:hidden">
          <SummaryCards data={data} hideAmounts={hideAmounts} />
          <CurrentMonthPanel data={data} hideAmounts={hideAmounts} />
          <OverdueView data={data} hideAmounts={hideAmounts} />
        </div>

        {/* Desktop: full table */}
        <div className="hidden sm:block">
          <ExpenseTable store={store} filter={filter} editMode={editMode} hideAmounts={hideAmounts} />
        </div>

        {/* Mobile: month card view */}
        <MobileMonthView store={store} filter={filter} editMode={editMode} year={data.year} hideAmounts={hideAmounts} />

        {showCharts && <ChartsSection data={data} hideAmounts={hideAmounts} />}

        {/* Legend (desktop only) */}
        <div className="mt-3 hidden sm:flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground print:hidden">
          <span className="flex items-center gap-1.5">
            <HelpCircle className="h-3 w-3" />Kliknij komórkę · opłacone blokują się <Lock className="h-2.5 w-2.5 inline mx-0.5 opacity-50" />
          </span>
          {[
            { cls: 'st-paid st-paid-m', label: `${names.m}✓`, desc: `${names.m} zapłaciła` },
            { cls: 'st-paid st-paid-j', label: `${names.j}✓`, desc: `${names.j} zapłacił` },
            { cls: 'st-paid st-paid-mj',label: '✓',  desc: 'Oboje' },
            { cls: 'st-unpaid',         label: '—',  desc: 'Do opłacenia' },
            { cls: 'st-notreq',         label: '·',  desc: 'Niewymagane' },
          ].map(({ cls, label, desc }) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className={`w-6 h-4 rounded border border-border flex items-center justify-center font-bold text-[9px] ${cls}`}>{label}</span>
              {desc}
            </span>
          ))}
        </div>
      </main>

      {/* ── Dialogs ── */}
      <ManageCategoriesDialog
        open={manageCatsOpen} onOpenChange={setManageCatsOpen}
        categories={data.categories}
        cells={data.cells}
        onAdd={addCategory} onUpdate={updateCategory} onDelete={deleteCategory}
        trashedCategories={store.trashCategories}
        onRestore={(id) => { restoreCategory(id); toast.success('Kategoria przywrócona'); }}
        onPermanentDelete={(id) => { permanentlyDeleteCategory(id); toast.success('Kategoria usunięta na stałe'); }}
        onResetCell={(catId, mi) => setStatus(catId, mi, 'unpaid')}
        onClearAll={clearAllCells}
        onSetNote={setNote}
      />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen}
        onExport={handleExport} onImport={handleImport}
        onExportCsv={handleExportCsv} onExportExcel={handleExportExcel} />
      <PdfExportDialog open={pdfOpen} onOpenChange={setPdfOpen} data={data} />

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="sm:max-w-md max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Historia zmian</DialogTitle>
            <DialogDescription>Ostatnie akcje w aplikacji. Przycisk „Cofnij” przywraca poprzedni stan.</DialogDescription>
          </DialogHeader>
          <div className="category-scroll overflow-y-auto space-y-1.5 pr-1 py-1">
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground rounded-xl border border-dashed border-border p-6 text-center">Brak zapisanej historii zmian.</p>
            ) : history.map(item => (
              <div key={item.id} className="rounded-xl border border-border bg-muted/25 px-3 py-2">
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-[11px] text-muted-foreground">{new Date(item.at).toLocaleString('pl-PL')}</p>
              </div>
            ))}
          </div>
          <div className="flex justify-between gap-2 border-t border-border pt-3">
            <Button variant="outline" size="sm" disabled={!canUndo} onClick={() => { undoLastChange(); toast.success('Cofnięto ostatnią zmianę'); }}>Cofnij ostatnią</Button>
            <Button variant="ghost" size="sm" onClick={clearHistoryLog}>Wyczyść listę</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Toaster richColors />
      <InstallPrompt />
    </div>
  );
}

// ── Root component — PinGate wraps AppContent so context is available inside ──
export default function App() {
  return (
    <PinGate>
      <AppContent />
    </PinGate>
  );
}
