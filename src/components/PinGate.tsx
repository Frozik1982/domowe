import {
  useState,
  useCallback,
  useEffect,
  useRef,
  createContext,
  useContext,
} from 'react';

const SESSION_KEY = 'expense-authorized';
export const PIN_HASH_KEY = 'expense-pin-hash';
const FAILED_ATTEMPTS_KEY = 'expense-pin-failed-attempts';
const LOCK_UNTIL_KEY = 'expense-pin-lock-until';

const PIN_LENGTH = 6;
const MAX_ATTEMPTS = 5;
const LOCK_MS = 30_000;
const AUTO_LOCK_MS = 5 * 60_000;
const KEYS = ['1','2','3','4','5','6','7','8','9','⌫','0',''];

function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
}

interface PinGateCtx {
  logout: () => void;
}

const PinGateContext = createContext<PinGateCtx>({ logout: () => {} });

export function useLogout() {
  return useContext(PinGateContext);
}

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hasConfiguredPin(): boolean {
  return !!localStorage.getItem(PIN_HASH_KEY);
}

export function getStoredHash() {
  return localStorage.getItem(PIN_HASH_KEY);
}

function getLockLeftSeconds(): number {
  const lockUntil = Number(localStorage.getItem(LOCK_UNTIL_KEY) || 0);
  const left = Math.ceil((lockUntil - Date.now()) / 1000);
  return Math.max(0, left);
}

export default function PinGate({ children }: { children: React.ReactNode }) {
  const [authorized, setAuthorized] = useState(
    () => sessionStorage.getItem(SESSION_KEY) === 'true' && hasConfiguredPin(),
  );
  const [setupMode, setSetupMode] = useState(() => !hasConfiguredPin());
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [setupStep, setSetupStep] = useState<'new' | 'confirm'>('new');
  const [errorText, setErrorText] = useState('');
  const [shake, setShake] = useState(false);
  const [lockLeft, setLockLeft] = useState(getLockLeftSeconds);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoLockTimerRef = useRef<number | null>(null);
  const allowNativeFocusRef = useRef(!isTouchDevice());

  const clearErrorSoon = useCallback((message: string) => {
    setErrorText(message);
    setShake(true);
    window.setTimeout(() => {
      setErrorText('');
      setShake(false);
    }, 1800);
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setAuthorized(false);
    setPin('');
    setConfirmPin('');
    setSetupStep('new');
    setSetupMode(!hasConfiguredPin());
  }, []);

  const resetAutoLockTimer = useCallback(() => {
    if (!authorized) return;
    if (autoLockTimerRef.current) window.clearTimeout(autoLockTimerRef.current);
    autoLockTimerRef.current = window.setTimeout(() => {
      logout();
    }, AUTO_LOCK_MS);
  }, [authorized, logout]);

  useEffect(() => {
    if (!authorized) return;

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((eventName) => window.addEventListener(eventName, resetAutoLockTimer, { passive: true }));
    resetAutoLockTimer();

    return () => {
      if (autoLockTimerRef.current) window.clearTimeout(autoLockTimerRef.current);
      events.forEach((eventName) => window.removeEventListener(eventName, resetAutoLockTimer));
    };
  }, [authorized, resetAutoLockTimer]);

  useEffect(() => {
    if (lockLeft <= 0) return;
    const timer = window.setInterval(() => {
      setLockLeft(getLockLeftSeconds());
    }, 500);
    return () => window.clearInterval(timer);
  }, [lockLeft]);

  useEffect(() => {
    if (!authorized && allowNativeFocusRef.current) {
      const t = window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 50);
      return () => window.clearTimeout(t);
    }
  }, [authorized, setupMode]);

  const registerFailedAttempt = useCallback(() => {
    const nextAttempts = Number(localStorage.getItem(FAILED_ATTEMPTS_KEY) || 0) + 1;
    localStorage.setItem(FAILED_ATTEMPTS_KEY, String(nextAttempts));

    if (nextAttempts >= MAX_ATTEMPTS) {
      const until = Date.now() + LOCK_MS;
      localStorage.setItem(LOCK_UNTIL_KEY, String(until));
      localStorage.setItem(FAILED_ATTEMPTS_KEY, '0');
      setLockLeft(Math.ceil(LOCK_MS / 1000));
      clearErrorSoon('Za dużo błędnych prób. Spróbuj za chwilę.');
      return;
    }

    clearErrorSoon(`Nieprawidłowy PIN. Pozostało prób: ${MAX_ATTEMPTS - nextAttempts}`);
  }, [clearErrorSoon]);

  const saveNewPin = useCallback(async (value: string) => {
    const hash = await sha256(value);
    localStorage.setItem(PIN_HASH_KEY, hash);
    localStorage.setItem(FAILED_ATTEMPTS_KEY, '0');
    localStorage.removeItem(LOCK_UNTIL_KEY);
    sessionStorage.setItem(SESSION_KEY, 'true');
    setSetupMode(false);
    setAuthorized(true);
    setPin('');
    setConfirmPin('');
  }, []);

  const tryPin = useCallback(async (value: string) => {
    if (getLockLeftSeconds() > 0) {
      setLockLeft(getLockLeftSeconds());
      return;
    }

    const storedHash = getStoredHash();
    if (!storedHash) {
      setSetupMode(true);
      return;
    }

    const hash = await sha256(value);
    if (hash === storedHash) {
      localStorage.setItem(FAILED_ATTEMPTS_KEY, '0');
      localStorage.removeItem(LOCK_UNTIL_KEY);
      sessionStorage.setItem(SESSION_KEY, 'true');
      setAuthorized(true);
      setPin('');
    } else {
      setPin('');
      registerFailedAttempt();
    }
  }, [registerFailedAttempt]);

  const handleCompletedPin = useCallback(async (value: string) => {
    if (!setupMode) {
      await tryPin(value);
      return;
    }

    if (setupStep === 'new') {
      if (value.length !== PIN_LENGTH) return;
      setPin('');
      setConfirmPin(value);
      setSetupStep('confirm');
      return;
    }

    if (value !== confirmPin) {
      setPin('');
      setConfirmPin('');
      setSetupStep('new');
      clearErrorSoon('PIN-y nie są takie same. Ustaw PIN ponownie.');
      return;
    }

    await saveNewPin(value);
  }, [clearErrorSoon, confirmPin, saveNewPin, setupMode, setupStep, tryPin]);

  const setPinDigits = useCallback((digits: string) => {
    const clean = digits.replace(/\D/g, '').slice(0, PIN_LENGTH);
    setPin(clean);
    if (clean.length === PIN_LENGTH) {
      void handleCompletedPin(clean);
      setPin('');
    }
  }, [handleCompletedPin]);

  const press = useCallback((key: string) => {
    if (lockLeft > 0) return;
    if (key === '⌫') {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (key === '') return;
    setPin((prev) => {
      const next = (prev + key).slice(0, PIN_LENGTH);
      if (next.length === PIN_LENGTH) {
        void handleCompletedPin(next);
        return '';
      }
      return next;
    });
  }, [handleCompletedPin, lockLeft]);

  useEffect(() => {
    if (authorized) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditableTarget = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if (isEditableTarget && target !== inputRef.current) return;

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        press(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        press('⌫');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [authorized, press]);

  if (authorized) {
    return (
      <PinGateContext.Provider value={{ logout }}>
        {children}
      </PinGateContext.Provider>
    );
  }

  const title = setupMode ? 'Ustaw własny PIN' : 'Płatności domowe';
  const subtitle = setupMode
    ? setupStep === 'new'
      ? 'Wpisz nowy 6-cyfrowy PIN'
      : 'Powtórz nowy PIN'
    : lockLeft > 0
      ? `Logowanie zablokowane jeszcze przez ${lockLeft} s`
      : 'Podaj 6-cyfrowy kod PIN';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background"
      onClick={() => {
        if (allowNativeFocusRef.current) inputRef.current?.focus({ preventScroll: true });
      }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-primary/8 blur-3xl" />
        <div
          className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-chart-2/5 blur-3xl"
          style={{ background: 'radial-gradient(circle, hsl(var(--chart-2) / 0.07), transparent)' }}
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/3 blur-3xl" />
      </div>

      <div className={`relative w-full max-w-xs mx-4 ${shake ? 'animate-shake' : ''}`}>
        <div className="bg-card/95 backdrop-blur-xl border border-border/60 rounded-3xl shadow-2xl overflow-hidden">
          <div className="header-accent-strip" />

          <div className="p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
              <span className="text-3xl select-none">💳</span>
            </div>
            <h1 className="text-lg font-bold text-foreground">{title}</h1>
            <p className="text-xs text-muted-foreground mt-1 mb-6">{subtitle}</p>

            <input
              ref={inputRef}
              value={pin}
              readOnly
              onPaste={(e) => {
                e.preventDefault();
                setPinDigits(e.clipboardData.getData('text'));
              }}
              inputMode="none"
              pattern="[0-9]*"
              autoComplete="off"
              aria-label="Kod PIN"
              disabled={lockLeft > 0}
              className="absolute opacity-0 pointer-events-none h-0 w-0"
            />

            <div className="flex justify-center gap-3 mb-5">
              {Array.from({ length: PIN_LENGTH }, (_, i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full transition-all duration-200 ${
                    errorText
                      ? 'bg-destructive scale-110'
                      : pin.length > i
                        ? 'bg-primary scale-125 shadow-sm'
                        : setupStep === 'confirm' && setupMode
                          ? 'bg-primary/30'
                          : 'bg-border'
                  }`}
                />
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {KEYS.map((key, i) => key === '' ? <div key={i} /> : (
                <button
                  key={i}
                  onClick={() => press(key)}
                  disabled={lockLeft > 0}
                  className={`h-14 text-xl rounded-2xl transition-all duration-150 active:scale-95 select-none font-semibold border disabled:opacity-40 disabled:cursor-not-allowed ${
                    key === '⌫'
                      ? 'bg-muted border-border text-muted-foreground hover:bg-muted/70'
                      : 'bg-secondary border-border text-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  {key}
                </button>
              ))}
            </div>

            {errorText && (
              <p className="text-xs text-destructive mt-4 font-medium animate-in fade-in-0">
                {errorText}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground/45 mt-5">
              PIN jest zapisywany jako hash. Po 5 minutach bezczynności aplikacja zablokuje się automatycznie.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
