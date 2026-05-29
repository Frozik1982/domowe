import { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useExpenseStore } from '@/hooks/useExpenseStore';
import { useDarkMode } from '@/hooks/useDarkMode';
import PinGate, { useLogout } from '@/components/PinGate';
import ExpenseTable from '@/components/ExpenseTable';
import MobileMonthView from '@/components/MobileMonthView';
import SummaryCards from '@/components/SummaryCards';
import SettingsDialog from '@/components/SettingsDialog';
import ChartsSection from '@/components/ChartsSection';
import ManageCategoriesDialog from '@/components/ManageCategoriesDialog';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Printer, Sun, Moon, Settings, BarChart2, List, Lock, Unlock, HelpCircle, LogOut } from 'lucide-react';
import InstallPrompt from '@/components/InstallPrompt';
import PdfExportDialog from '@/components/PdfExportDialog';
import { type FilterType } from '@/types';

const STORAGE_KEY = 'expense-tracker-v1';
const FILTERS: { label: string; value: FilterType }[] = [
  { label: 'Wszystkie', value: 'all' }, { label: 'M', value: 'M' },
  { label: 'J', value: 'J' },          { label: 'M+J', value: 'M+J' },
];

// ── Inner component — renders INSIDE PinGate so useLogout() has access to context ──
function AppContent() {
  const { logout } = useLogout();          // ✅ now inside PinGate Provider
  const { isDark, toggle: toggleDark } = useDarkMode();
  const store = useExpenseStore();

  const [filter, setFilter]                 = useState<FilterType>('all');
  const [manageCatsOpen, setManageCatsOpen] = useState(false);
  const [editMode, setEditMode]             = useState(false);
  const [settingsOpen, setSettingsOpen]     = useState(false);
  const [showCharts, setShowCharts]         = useState(false);
  const [pdfOpen, setPdfOpen]               = useState(false);

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
    toast.success('Dane wyeksportowane');
  }, []);

  const handleImport = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        toast.success('Dane zaimportowane — odświeżam stronę…');
        setTimeout(() => window.location.reload(), 800);
      } catch {
        toast.error('Nieprawidłowy plik backupu');
      }
    };
    reader.readAsText(file);
  }, []);

  const { data, setYear, addCategory, updateCategory, deleteCategory, setStatus, clearAllCells, setNote } = store;
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
                {FILTERS.map(f => (
                  <button key={f.value} onClick={() => setFilter(f.value)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${filter === f.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                    {f.label}
                  </button>
                ))}
              </div>

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
                <BarChart2 className="h-3.5 w-3.5" /><span className="hidden sm:inline">Wykresy</span>
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={toggleDark}
                title={isDark ? 'Tryb jasny' : 'Tryb ciemny'}>
                {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
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
        <p className="text-[10px] text-gray-500 mt-0.5">M✓ / J✓ = kto zapłacił · ✓ = oboje · — = do opłacenia · · = niewymagane</p>
      </div>

      {/* ── Main content ── */}
      <main className="container mx-auto px-3 sm:px-4 py-4 print:p-2 print:max-w-none">
        <div className="print:hidden">
          <SummaryCards data={data} />
        </div>

        {/* Desktop: full table */}
        <div className="hidden sm:block">
          <ExpenseTable store={store} filter={filter} editMode={editMode} />
        </div>

        {/* Mobile: month card view */}
        <MobileMonthView store={store} filter={filter} editMode={editMode} year={data.year} />

        {showCharts && <ChartsSection data={data} />}

        {/* Legend (desktop only) */}
        <div className="mt-3 hidden sm:flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground print:hidden">
          <span className="flex items-center gap-1.5">
            <HelpCircle className="h-3 w-3" />Kliknij komórkę · opłacone blokują się <Lock className="h-2.5 w-2.5 inline mx-0.5 opacity-50" />
          </span>
          {[
            { cls: 'st-paid st-paid-m', label: 'M✓', desc: 'M zapłacił' },
            { cls: 'st-paid st-paid-j', label: 'J✓', desc: 'J zapłaciła' },
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
        onResetCell={(catId, mi) => setStatus(catId, mi, 'unpaid')}
        onClearAll={clearAllCells}
        onSetNote={setNote}
      />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen}
        onExport={handleExport} onImport={handleImport} />
      <PdfExportDialog open={pdfOpen} onOpenChange={setPdfOpen} data={data} />

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
