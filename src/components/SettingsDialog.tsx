import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, Upload, KeyRound, FileSpreadsheet, Users, Save } from 'lucide-react';
import { sha256, getStoredHash, PIN_HASH_KEY } from '@/components/PinGate';
import { usePayerNames } from '@/hooks/usePayerNames';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onExportCsv: () => void;
  onExportExcel: () => void;
}

function lastBackupText(): string {
  const raw = localStorage.getItem('expense-last-backup-date');
  if (!raw) return 'brak informacji';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return 'brak informacji';
  return date.toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function SettingsDialog({ open, onOpenChange, onExport, onImport, onExportCsv, onExportExcel }: Props) {
  const { names, setNames } = usePayerNames();
  const [mName, setMName] = useState(names.m);
  const [jName, setJName] = useState(names.j);
  const [backupInfo, setBackupInfo] = useState(lastBackupText());
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setMName(names.m);
      setJName(names.j);
      setBackupInfo(lastBackupText());
    }
  }, [open, names.m, names.j]);

  function handleSaveNames() {
    setNames({ m: mName, j: jName });
    toast.success('Nazwy użytkowników zapisane');
  }

  function handleJsonExport() {
    onExport();
    setBackupInfo(lastBackupText());
  }

  async function handleChangePin() {
    if (next.length !== 6 || !/^\d+$/.test(next)) { toast.error('Nowy PIN musi mieć 6 cyfr'); return; }
    if (next !== confirm) { toast.error('Nowe PINy nie są identyczne'); return; }
    setBusy(true);
    const curHash = await sha256(cur);
    if (curHash !== getStoredHash()) { toast.error('Aktualny PIN jest nieprawidłowy'); setBusy(false); return; }
    localStorage.setItem(PIN_HASH_KEY, await sha256(next));
    setCur(''); setNext(''); setConfirm('');
    toast.success('PIN został zmieniony!');
    setBusy(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>⚙️ Ustawienia</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Payer names */}
          <div className="space-y-2.5 rounded-xl border border-border bg-muted/15 p-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> Nazwy zamiast M / J
            </h3>
            <p className="text-xs text-muted-foreground">M jest oznaczana jako osoba, która „zapłaciła”; J jako osoba, która „zapłacił”.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Nazwa M</Label>
                <Input value={mName} onChange={e => setMName(e.target.value)} maxLength={24} className="mt-1" placeholder="np. Magda" />
              </div>
              <div>
                <Label className="text-xs">Nazwa J</Label>
                <Input value={jName} onChange={e => setJName(e.target.value)} maxLength={24} className="mt-1" placeholder="np. Jarek" />
              </div>
            </div>
            <Button size="sm" className="w-full gap-1.5" onClick={handleSaveNames}>
              <Save className="h-3.5 w-3.5" /> Zapisz nazwy
            </Button>
          </div>

          {/* Backup */}
          <div className="space-y-2.5 rounded-xl border border-border bg-muted/15 p-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Download className="h-3.5 w-3.5" /> Backup i import danych
            </h3>
            <p className="text-xs text-muted-foreground">Backup JSON zachowuje pełne dane aplikacji. Ostatni backup: <span className="font-semibold text-foreground">{backupInfo}</span>.</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" className="gap-1" onClick={handleJsonExport}>
                <Download className="h-3.5 w-3.5" /> Backup JSON
              </Button>
              <label>
                <Button variant="outline" size="sm" className="w-full gap-1 cursor-pointer" asChild>
                  <span><Upload className="h-3.5 w-3.5" /> Import JSON</span>
                </Button>
                <input type="file" accept=".json,application/json" className="hidden" onChange={e => e.target.files?.[0] && onImport(e.target.files[0])} />
              </label>
            </div>
          </div>

          {/* CSV / Excel */}
          <div className="space-y-2.5 rounded-xl border border-border bg-muted/15 p-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <FileSpreadsheet className="h-3.5 w-3.5" /> Eksport CSV / Excel
            </h3>
            <p className="text-xs text-muted-foreground">Eksportuje rok rozliczeniowy z kwotami, terminami, statusami i notatkami.</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" className="gap-1" onClick={onExportCsv}>CSV</Button>
              <Button variant="outline" size="sm" className="gap-1" onClick={onExportExcel}>Excel .xls</Button>
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Change PIN */}
          <div className="space-y-2.5">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5" /> Zmień PIN
            </h3>
            <div className="space-y-2">
              <div>
                <Label className="text-xs">Aktualny PIN</Label>
                <Input type="password" inputMode="numeric" maxLength={6} placeholder="••••••" value={cur} onChange={e => setCur(e.target.value.replace(/\D/g, ''))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Nowy PIN (6 cyfr)</Label>
                <Input type="password" inputMode="numeric" maxLength={6} placeholder="••••••" value={next} onChange={e => setNext(e.target.value.replace(/\D/g, ''))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Potwierdź nowy PIN</Label>
                <Input type="password" inputMode="numeric" maxLength={6} placeholder="••••••" value={confirm} onChange={e => setConfirm(e.target.value.replace(/\D/g, ''))} className="mt-1" />
              </div>
            </div>
            <Button size="sm" onClick={handleChangePin} disabled={!cur || !next || !confirm || busy} className="w-full">
              {busy ? 'Zmieniam…' : 'Zmień PIN'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
