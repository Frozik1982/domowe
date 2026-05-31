import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Cloud,
  CloudOff,
  Download,
  LogIn,
  LogOut,
  Upload,
  UserPlus,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import type { StoreData } from "@/hooks/useExpenseStore";

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

const CLOUD_MARKER_KEY = "expense-cloud-last-updated-at";

function formatDate(value?: string | null) {
  if (!value) return "brak";
  try {
    return new Date(value).toLocaleString("pl-PL");
  } catch {
    return value;
  }
}

function isValidStoreData(value: unknown): value is StoreData {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<StoreData>;
  return (
    typeof data.year === "number" &&
    Array.isArray(data.categories) &&
    Array.isArray(data.cells)
  );
}

function makeDataSignature(value: StoreData) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(Date.now());
  }
}

export default function CloudSyncDialog({
  open,
  onOpenChange,
  data,
  onReplaceData,
}: CloudSyncDialogProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "syncing" | "ready" | "offline" | "error" | "choice"
  >("idle");
  const [cloudUpdatedAt, setCloudUpdatedAt] = useState<string | null>(null);
  const [choiceRequired, setChoiceRequired] = useState(false);
  const [autoSyncReady, setAutoSyncReady] = useState(false);
  const [lastError, setLastError] = useState("");
  const didInitialLoad = useRef(false);
  const autosaveTimer = useRef<number | null>(null);
  const lastSyncedData = useRef<string>("");

  const userId = session?.user?.id;

  const deviceKind = useMemo(() => {
    if (typeof window === "undefined") return "urządzeniu";
    const ua = navigator.userAgent || "";
    const isMobile =
      /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || window.innerWidth < 768;
    return isMobile ? "telefonie" : "komputerze";
  }, []);

  const loadCloud = useCallback(async (): Promise<CloudRow | null> => {
    if (!supabase || !userId) return null;
    const { data: row, error } = await supabase
      .from("app_data")
      .select("data, updated_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    if (!row) return null;
    if (!isValidStoreData(row.data)) {
      throw new Error("Dane w chmurze mają nieprawidłowy format");
    }
    return row as CloudRow;
  }, [userId]);

  const uploadToCloud = useCallback(
    async (silent = false) => {
      if (!supabase || !userId) return;
      const signature = makeDataSignature(data);
      if (silent && signature === lastSyncedData.current) return;

      if (!silent) {
        setBusy(true);
        setStatus("syncing");
      }
      setLastError("");
      try {
        const { data: row, error } = await supabase
          .from("app_data")
          .upsert({ user_id: userId, data }, { onConflict: "user_id" })
          .select("updated_at")
          .single();

        if (error) throw error;
        const updatedAt = row?.updated_at ?? new Date().toISOString();
        lastSyncedData.current = signature;
        setCloudUpdatedAt(updatedAt);
        localStorage.setItem(CLOUD_MARKER_KEY, updatedAt);
        setChoiceRequired(false);
        setAutoSyncReady(true);
        setStatus("ready");
        if (!silent) toast.success("Wysłano do chmury");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Nieznany błąd";
        setLastError(message);
        setStatus(navigator.onLine ? "error" : "offline");
        if (!silent) toast.error("Nie udało się wysłać danych");
      } finally {
        if (!silent) setBusy(false);
      }
    },
    [data, userId],
  );

  const downloadFromCloud = useCallback(
    async (silent = false) => {
      if (!supabase || !userId) return;
      if (!silent) {
        setBusy(true);
        setStatus("syncing");
      }
      setLastError("");
      try {
        const row = await loadCloud();
        if (!row) {
          if (!silent) toast.info("W chmurze nie ma jeszcze danych — kliknij Wyślij");
          setStatus("choice");
          return;
        }
        lastSyncedData.current = makeDataSignature(row.data);
        onReplaceData(row.data);
        setCloudUpdatedAt(row.updated_at);
        localStorage.setItem(CLOUD_MARKER_KEY, row.updated_at);
        setChoiceRequired(false);
        setAutoSyncReady(true);
        setStatus("ready");
        if (!silent) toast.success("Odebrano dane z chmury");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Nieznany błąd";
        setLastError(message);
        setStatus(navigator.onLine ? "error" : "offline");
        if (!silent) toast.error("Nie udało się odebrać danych");
      } finally {
        if (!silent) setBusy(false);
      }
    },
    [loadCloud, onReplaceData, userId],
  );

  const inspectCloudOnLogin = useCallback(async () => {
    if (!supabase || !userId || didInitialLoad.current) return;
    didInitialLoad.current = true;
    setLastError("");
    try {
      const row = await loadCloud();
      if (!row) {
        setChoiceRequired(true);
        setAutoSyncReady(false);
        setStatus("choice");
        return;
      }

      setCloudUpdatedAt(row.updated_at);
      const localMarker = localStorage.getItem(CLOUD_MARKER_KEY);
      if (localMarker === row.updated_at) {
        lastSyncedData.current = makeDataSignature(data);
        setAutoSyncReady(true);
        setStatus("ready");
        return;
      }

      setChoiceRequired(true);
      setAutoSyncReady(false);
      setStatus("choice");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nieznany błąd";
      setLastError(message);
      setStatus(navigator.onLine ? "error" : "offline");
    }
  }, [data, loadCloud, userId]);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        didInitialLoad.current = false;
        setSession(nextSession);
        setChoiceRequired(false);
        setAutoSyncReady(false);
        setCloudUpdatedAt(null);
        setStatus("idle");
      },
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) inspectCloudOnLogin();
  }, [inspectCloudOnLogin, session]);

  useEffect(() => {
    if (!session || !autoSyncReady || choiceRequired || busy) return;
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(() => uploadToCloud(true), 2500);
    return () => {
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    };
  }, [autoSyncReady, busy, choiceRequired, data, session, uploadToCloud]);

  const signIn = async () => {
    if (!supabase) return;
    if (!email.trim() || password.length < 6) {
      toast.error("Podaj email i hasło min. 6 znaków");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Zalogowano");
  };

  const signUp = async () => {
    if (!supabase) return;
    if (!email.trim() || password.length < 6) {
      toast.error("Podaj email i hasło min. 6 znaków");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Konto utworzone. Możesz się zalogować");
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
    setAutoSyncReady(false);
    setChoiceRequired(false);
    setCloudUpdatedAt(null);
    setStatus("idle");
    toast.success("Wylogowano z chmury");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {session ? (
              <Cloud className="h-5 w-5 text-primary" />
            ) : (
              <CloudOff className="h-5 w-5 text-muted-foreground" />
            )}
            Chmura
          </DialogTitle>
          <DialogDescription>
            Wysyłaj dane do chmury albo odbieraj je na tym urządzeniu.
          </DialogDescription>
        </DialogHeader>

        {!isSupabaseConfigured ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            Brakuje zmiennych VITE_SUPABASE_URL albo VITE_SUPABASE_ANON_KEY.
          </div>
        ) : !session ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sync-email">Email</Label>
              <Input
                id="sync-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="twoj@email.pl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sync-password">Hasło</Label>
              <Input
                id="sync-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="minimum 6 znaków"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={signIn} disabled={busy} className="gap-2">
                <LogIn className="h-4 w-4" /> Zaloguj
              </Button>
              <Button
                onClick={signUp}
                disabled={busy}
                variant="outline"
                className="gap-2"
              >
                <UserPlus className="h-4 w-4" /> Utwórz konto
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Na urządzeniu z aktualnymi rachunkami kliknij „Wyślij”. Na drugim urządzeniu kliknij „Odbierz”.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/30 p-3">
              <p className="text-sm font-semibold text-foreground truncate">
                {session.user.email}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                To urządzenie: {deviceKind}
              </p>
              {cloudUpdatedAt && (
                <p className="text-xs text-muted-foreground mt-1">
                  Ostatni zapis w chmurze: {formatDate(cloudUpdatedAt)}
                </p>
              )}
              {lastError && (
                <p className="text-xs text-destructive mt-2 break-words">
                  {lastError}
                </p>
              )}
            </div>

            {choiceRequired && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                <p className="font-semibold text-amber-300">
                  Wybierz główne dane.
                </p>
                <p className="text-muted-foreground mt-1">
                  „Wyślij” zapisze dane z tego urządzenia w chmurze. „Odbierz” zastąpi dane na tym urządzeniu danymi z chmury.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => uploadToCloud(false)}
                disabled={busy}
                className="gap-2 min-w-0"
              >
                <Upload className="h-4 w-4 shrink-0" />
                <span>Wyślij</span>
              </Button>
              <Button
                onClick={() => downloadFromCloud(false)}
                disabled={busy}
                variant="outline"
                className="gap-2 min-w-0"
              >
                <Download className="h-4 w-4 shrink-0" />
                <span>Odbierz</span>
              </Button>
            </div>

            <div className="rounded-xl border border-border p-3 text-xs text-muted-foreground space-y-1">
              <p>
                <strong className="text-foreground">Wyślij</strong> — kiedy aktualne dane są na tym {deviceKind}.
              </p>
              <p>
                <strong className="text-foreground">Odbierz</strong> — kiedy aktualne dane są już w chmurze.
              </p>
              {autoSyncReady && (
                <p>Po wyborze kolejne zmiany zapisują się automatycznie.</p>
              )}
            </div>

            <Button
              onClick={signOut}
              disabled={busy}
              variant="ghost"
              className="gap-2 w-full text-muted-foreground hover:text-destructive"
            >
              <LogOut className="h-4 w-4" /> Wyloguj z chmury
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
