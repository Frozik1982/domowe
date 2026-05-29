import { useEffect, useState } from 'react';
import { Download, X, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function useIsPwaMode() {
  const [isPwa, setIsPwa] = useState(false);
  useEffect(() => {
    const mq1 = window.matchMedia('(display-mode: standalone)');
    const mq2 = window.matchMedia('(display-mode: fullscreen)');
    const update = () => {
      const ios = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
      setIsPwa(mq1.matches || mq2.matches || ios);
    };
    update();
    mq1.addEventListener('change', update);
    mq2.addEventListener('change', update);
    return () => { mq1.removeEventListener('change', update); mq2.removeEventListener('change', update); };
  }, []);
  return isPwa;
}

const DISMISS_KEY = 'pwa-install-dismissed';

function getInstructions() {
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'Na iOS: dotknij ikony Udostępnij → „Dodaj do ekranu głównego"';
  if (/android/.test(ua)) return 'Na Android: menu przeglądarki → „Dodaj do ekranu głównego"';
  return 'Kliknij ikonę instalacji w pasku adresu przeglądarki';
}

export default function InstallPrompt() {
  const isPwa = useIsPwaMode();
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1');
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setPrompt(e as BeforeInstallPromptEvent); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (isPwa || dismissed) return null;

  const dismiss = () => { localStorage.setItem(DISMISS_KEY, '1'); setDismissed(true); };

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    setPrompt(null);
    dismiss();
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 sm:left-auto sm:right-4 sm:w-80 print:hidden">
      <div className="bg-card border border-border rounded-2xl shadow-2xl p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="bg-primary/10 rounded-xl p-2 shrink-0">
            <Smartphone className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Zainstaluj aplikację</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {prompt ? 'Dodaj do ekranu głównego — szybki dostęp bez przeglądarki.' : getInstructions()}
            </p>
          </div>
          <button onClick={dismiss} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex gap-2">
          {prompt && (
            <Button size="sm" className="flex-1 gap-1.5 text-xs" onClick={install}>
              <Download className="h-3.5 w-3.5" /> Zainstaluj
            </Button>
          )}
          <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={dismiss}>
            Nie teraz
          </Button>
        </div>
      </div>
    </div>
  );
}
