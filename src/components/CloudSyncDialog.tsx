import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Cloud, CloudOff, Download, LogIn, LogOut, RefreshCw, Upload, UserPlus } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { isSupabaseConfigured, supabase } from '@/lib/supabaseClient';
import type { StoreData } from '@/hooks/useExpenseStore';

interface CloudRow {
  data: StoreData;
  updated_at: string;
}

interface CloudSyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: StoreData;
  onReplaceData: (data: StoreData) => void;
}

const CLOUD_MARKER_KEY = 'expense-cloud-last-updated-at';

function formatDate(value?: string | null) {
  if (!value) return 'brak';
  try {
    return new Date(value).toLocaleString('pl-PL');
  } catch {
    return value;
  }
}

function isValidStoreData(value: unknown): value is StoreData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<StoreData>;
  return typeof data.year === 'number' && Array.isArray(data.categories) && Array.isArray(data.cells);
}

export default function CloudSyncDialog({ open, onOpenChange, data, onReplaceData }: CloudSyncDialogProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<'idle' | 'syncing' | 'ready' | 'offline' | 'error' | 'choice'>('idle');
  const [cloudUpdatedAt, setCloudUpdatedAt] = useState<string | null>(null);
  const [choiceRequired, setChoiceRequired] = useState(false);
  const [autoSyncReady, setAutoSyncReady] = useState(false);
  const [lastError, setLastError] = useState('');
  const didInitialLoad = useRef(false);
  const autosaveTimer = useRef<number | null>(null);

  const userId = session?.user?.id;

  const readableStatus = useMemo(() => {
    if (!isSupabaseConfigured) return 'Supabase nie jest skonfigurowany';
    if (!session) return 'Nie zalogowano do chmury';
    if (status === 'syncing') return 'Synchronizacja...';
    if (status === 'choice') return 'Wybierz, które dane mają być główne';
    if (status === 'offline') return 'Brak połączenia lub błąd sieci';
    if (status === 'error') return 'Błąd synchronizacji';
    if (status === 'ready') return `Połączono · ostatni zapis: ${formatDate(cloudUpdatedAt)}`;
    return 'Połączono';
  }, [cloudUpdatedAt, session, status]);

  const loadCloud = useCallback(async (): Promise<CloudRow | null> => {
    if (!supabase || !userId) return null;
    const { data: row, error } = await supabase
      .from('app_data')
      .select('data, updated_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    if (!row) return null;
    if (!isValidStoreData(row.data)) throw new Error('Dane w chmurze mają nieprawidłowy format');
    return row as CloudRow;
  }, [userId]);

  const uploadToCloud = useCallback(async (silent = false) => {
    if (!supabase || !userId) return;
    setBusy(true);
    setStatus('syncing');
    setLastError('');
    try {
      const { data: row, error } = await supabase
        .from('app_data')
        .upsert({ user_id: userId, data }, { onConflict: 'user_id' })
        .select('updated_at')
        .single();

      if (error) throw error;
      const updatedAt = row?.updated_at ?? new Date().toISOString();
      setCloudUpdatedAt(updatedAt);
      localStorage.setItem(CLOUD_MARKER_KEY, updatedAt);
      setChoiceRequired(false);
      setAutoSyncReady(true);
      setStatus('ready');
      if (!silent) toast.success('Dane wysłane do chmury');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nieznany błąd';
      setLastError(message);
      setStatus(navigator.onLine ? 'error' : 'offline');
      if (!silent) toast.error('Nie udało się wysłać danych do chmury');
    } finally {
      setBusy(false);
    }
  }, [data, userId]);

  const downloadFromCloud = useCallback(async (silent = false) => {
    if (!supabase || !userId) return;
    setBusy(true);
    setStatus('syncing');
    setLastError('');
    try {
      const row = await loadCloud();
      if (!row) {
        if (!silent) toast.info('W chmurze nie ma jeszcze danych — wyślij dane lokalne');
        setStatus('choice');
        return;
      }
      onReplaceData(row.data);
      setCloudUpdatedAt(row.updated_at);
      localStorage.setItem(CLOUD_MARKER_KEY, row.updated_at);
      setChoiceRequired(false);
      setAutoSyncReady(true);
      setStatus('ready');
      if (!silent) toast.success('Dane pobrane z chmury');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nieznany błąd';
      setLastError(message);
      setStatus(navigator.onLine ? 'error' : 'offline');
      if (!silent) toast.error('Nie udało się pobrać danych z chmury');
    } finally {
      setBusy(false);
    }
  }, [loadCloud, onReplaceData, userId]);

  const inspectCloudOnLogin = useCallback(async () => {
    if (!supabase || !userId || didInitialLoad.current) return;
    didInitialLoad.current = true;
    setBusy(true);
    setStatus('syncing');
    setLastError('');
    try {
      const row = await loadCloud();
      if (!row) {
        await uploadToCloud(true);
        toast.success('Utworzono kopię danych w chmurze');
        return;
      }

      setCloudUpdatedAt(row.updated_at);
      const localMarker = localStorage.getItem(CLOUD_MARKER_KEY);
      if (localMarker === row.updated_at) {
        setAutoSyncReady(true);
        setStatus('ready');
        return;
      }

      setChoiceRequired(true);
      setAutoSyncReady(false);
      setStatus('choice');
      toast.info('Wybierz, czy wysłać dane lokalne, czy pobrać dane z chmury');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nieznany błąd';
      setLastError(message);
      setStatus(navigator.onLine ? 'error' : 'offline');
    } finally {
      setBusy(false);
    }
  }, [loadCloud, uploadToCloud, userId]);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      didInitialLoad.current = false;
      setSession(nextSession);
      setChoiceRequired(false);
      setAutoSyncReady(false);
      setCloudUpdatedAt(null);
      setStatus(nextSession ? 'idle' : 'idle');
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) inspectCloudOnLogin();
  }, [inspectCloudOnLogin, session]);

  useEffect(() => {
    if (!session || !autoSyncReady || choiceRequired || busy) return;
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(() => uploadToCloud(true), 1500);
    return () => {
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    };
  }, [autoSyncReady, busy, choiceRequired, data, session, uploadToCloud]);

  const signIn = async () => {
    if (!supabase) return;
    if (!email.trim() || password.length < 6) {
      toast.error('Podaj email i hasło min. 6 znaków');
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success('Zalogowano');
  };

  const signUp = async () => {
    if (!supabase) return;
    if (!email.trim() || password.length < 6) {
      toast.error('Podaj email i hasło min. 6 znaków');
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signUp({ email: email.trim(), password });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success('Konto utworzone. Możesz się zalogować');
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
    setAutoSyncReady(false);
    setChoiceRequired(false);
    setCloudUpdatedAt(null);
    setStatus('idle');
    toast.success('Wylogowano z chmury');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {session ? <Cloud className="h-5 w-5 text-primary" /> : <CloudOff className="h-5 w-5 text-muted-foreground" />}
            Synchronizacja telefonu i komputera
          </DialogTitle>
          <DialogDescription>
            Dane będą zapisywane w Supabase i dostępne po zalogowaniu na innych urządzeniach.
          </DialogDescription>
        </DialogHeader>

        {!isSupabaseConfigured ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            Brakuje zmiennych VITE_SUPABASE_URL albo VITE_SUPABASE_ANON_KEY. Dodaj je w Vercel i w pliku .env.local.
          </div>
        ) : !session ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sync-email">Email</Label>
              <Input id="sync-email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="twoj@email.pl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sync-password">Hasło</Label>
              <Input id="sync-password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="minimum 6 znaków" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={signIn} disabled={busy} className="gap-2"><LogIn className="h-4 w-4" /> Zaloguj</Button>
              <Button onClick={signUp} disabled={busy} variant="outline" className="gap-2"><UserPlus className="h-4 w-4" /> Utwórz konto</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Najpierw zaloguj się na urządzeniu, gdzie masz aktualne dane, i wybierz „Wyślij lokalne dane do chmury”.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/30 p-3">
              <p className="text-sm font-semibold text-foreground">{session.user.email}</p>
              <p className="text-xs text-muted-foreground mt-1">{readableStatus}</p>
              {lastError && <p className="text-xs text-destructive mt-2 break-words">{lastError}</p>}
            </div>

            {choiceRequired && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                <p className="font-semibold text-amber-300">Wykryto różne dane lokalne i w chmurze.</p>
                <p className="text-muted-foreground mt-1">Na pierwszym urządzeniu wybierz wysłanie danych lokalnych. Na kolejnym urządzeniu wybierz pobranie z chmury.</p>
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-3">
              <Button onClick={() => uploadToCloud(false)} disabled={busy} className="gap-2">
                <Upload className="h-4 w-4" /> Wyślij lokalne
              </Button>
              <Button onClick={() => downloadFromCloud(false)} disabled={busy} variant="outline" className="gap-2">
                <Download className="h-4 w-4" /> Pobierz z chmury
              </Button>
              <Button onClick={() => downloadFromCloud(false)} disabled={busy} variant="secondary" className="gap-2">
                <RefreshCw className="h-4 w-4" /> Sync teraz
              </Button>
            </div>

            <div className="rounded-xl border border-border p-3 text-xs text-muted-foreground space-y-1">
              <p><strong className="text-foreground">Pierwsze urządzenie:</strong> kliknij „Wyślij lokalne”.</p>
              <p><strong className="text-foreground">Drugie urządzenie:</strong> kliknij „Pobierz z chmury”.</p>
              <p>Po wyborze aplikacja zapisuje zmiany w chmurze automatycznie.</p>
            </div>

            <Button onClick={signOut} disabled={busy} variant="ghost" className="gap-2 w-full text-muted-foreground hover:text-destructive">
              <LogOut className="h-4 w-4" /> Wyloguj z chmury
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
