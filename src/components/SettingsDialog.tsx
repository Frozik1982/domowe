import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, Upload, KeyRound } from 'lucide-react';
import { sha256, getStoredHash, PIN_HASH_KEY } from '@/components/PinGate';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: () => void;
  onImport: (file: File) => void;
}

export default function SettingsDialog({ open, onOpenChange, onExport, onImport }: Props) {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

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
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>⚙️ Ustawienia</DialogTitle>
        </DialogHeader>

        {/* Backup */}
        <div className="space-y-2.5">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Download className="h-3.5 w-3.5" /> Kopia zapasowa
          </h3>
          <p className="text-xs text-muted-foreground">Eksportuj dane do pliku .json, aby nie stracić historii przy czyszczeniu przeglądarki.</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={onExport}>
              <Download className="h-3.5 w-3.5" /> Eksportuj
            </Button>
            <label className="flex-1">
              <Button variant="outline" size="sm" className="w-full gap-1 cursor-pointer" asChild>
                <span><Upload className="h-3.5 w-3.5" /> Importuj</span>
              </Button>
              <input
                type="file" accept=".json" className="hidden"
                onChange={e => e.target.files?.[0] && onImport(e.target.files[0])}
              />
            </label>
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
              <Input type="password" inputMode="numeric" maxLength={6} placeholder="••••••"
                value={cur} onChange={e => setCur(e.target.value.replace(/\D/g, ''))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Nowy PIN (6 cyfr)</Label>
              <Input type="password" inputMode="numeric" maxLength={6} placeholder="••••••"
                value={next} onChange={e => setNext(e.target.value.replace(/\D/g, ''))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Potwierdź nowy PIN</Label>
              <Input type="password" inputMode="numeric" maxLength={6} placeholder="••••••"
                value={confirm} onChange={e => setConfirm(e.target.value.replace(/\D/g, ''))} className="mt-1" />
            </div>
          </div>
          <Button size="sm" onClick={handleChangePin} disabled={!cur || !next || !confirm || busy} className="w-full">
            {busy ? 'Zmieniam…' : 'Zmień PIN'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
