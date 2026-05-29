import { useState, useCallback, useEffect, createContext, useContext } from 'react';

const DEFAULT_HASH = '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92'; // SHA-256("123456")
const SESSION_KEY  = 'expense-authorized';
export const PIN_HASH_KEY = 'expense-pin-hash';

// ── Context: lets any child call logout() without prop-drilling ──────────────
interface PinGateCtx { logout: () => void }
const PinGateContext = createContext<PinGateCtx>({ logout: () => {} });
export function useLogout() { return useContext(PinGateContext); }

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function getStoredHash() {
  return localStorage.getItem(PIN_HASH_KEY) ?? DEFAULT_HASH;
}

const KEYS      = ['1','2','3','4','5','6','7','8','9','⌫','0',''];
const PIN_LENGTH = 6;

export default function PinGate({ children }: { children: React.ReactNode }) {
  // sessionStorage: persists across page refreshes within the same tab,
  // but is automatically cleared when the tab / browser is closed.
  const [authorized, setAuthorized] = useState(() =>
    sessionStorage.getItem(SESSION_KEY) === 'true'
  );
  const [pin, setPin]     = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  const logout = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setAuthorized(false);
  }, []);

  const tryPin = useCallback(async (value: string) => {
    const hash = await sha256(value);
    if (hash === getStoredHash()) {
      sessionStorage.setItem(SESSION_KEY, 'true');
      setAuthorized(true);
    } else {
      setError(true);
      setShake(true);
      setPin('');
      setTimeout(() => { setError(false); setShake(false); }, 600);
    }
  }, []);

  const press = useCallback((key: string) => {
    if (key === '⌫') { setPin(p => p.slice(0, -1)); return; }
    if (key === '')   return;
    setPin(prev => {
      const next = prev + key;
      if (next.length === PIN_LENGTH) { tryPin(next); return ''; }
      return next;
    });
  }, [tryPin]);

  // ── Keyboard support ────────────────────────────────────────────────────────
  useEffect(() => {
    if (authorized) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') press(e.key);
      else if (e.key === 'Backspace') press('⌫');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [authorized, press]);

  // ── Authorized: provide logout function to the whole app ──────────────────
  if (authorized) {
    return (
      <PinGateContext.Provider value={{ logout }}>
        {children}
      </PinGateContext.Provider>
    );
  }

  // ── PIN screen ─────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      {/* Decorative blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-chart-2/5 blur-3xl" style={{ background: `radial-gradient(circle, hsl(var(--chart-2) / 0.07), transparent)` }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/3 blur-3xl" />
      </div>

      <div className={`relative w-full max-w-xs mx-4 ${shake ? 'animate-shake' : ''}`}>
        <div className="bg-card/95 backdrop-blur-xl border border-border/60 rounded-3xl shadow-2xl overflow-hidden">
          {/* Top accent strip */}
          <div className="header-accent-strip" />

          <div className="p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
              <span className="text-3xl select-none">💳</span>
            </div>
            <h1 className="text-lg font-bold text-foreground">Płatności domowe</h1>
            <p className="text-xs text-muted-foreground mt-1 mb-6">Podaj 6-cyfrowy kod PIN</p>

            {/* PIN dots */}
            <div className="flex justify-center gap-3 mb-7">
              {Array.from({ length: PIN_LENGTH }, (_, i) => (
                <div key={i} className={`w-3 h-3 rounded-full transition-all duration-200 ${
                  error ? 'bg-destructive scale-110' : pin.length > i ? 'bg-primary scale-125 shadow-sm' : 'bg-border'
                }`} />
              ))}
            </div>

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-2.5">
              {KEYS.map((key, i) => key === '' ? <div key={i} /> : (
                <button
                  key={i}
                  onClick={() => press(key)}
                  className={`h-14 text-xl rounded-2xl transition-all duration-150 active:scale-95 select-none font-semibold border ${
                    key === '⌫'
                      ? 'bg-muted border-border text-muted-foreground hover:bg-muted/70'
                      : 'bg-secondary border-border text-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  {key}
                </button>
              ))}
            </div>

            {error && <p className="text-xs text-destructive mt-4 font-medium animate-in fade-in-0">Nieprawidłowy kod PIN</p>}
            <p className="text-[10px] text-muted-foreground/35 mt-5">Domyślny PIN: 123456</p>
          </div>
        </div>
      </div>
    </div>
  );
}
