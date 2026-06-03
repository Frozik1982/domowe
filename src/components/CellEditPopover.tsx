import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { type CellStatus, type AssignedTo, type CellDocument } from '@/hooks/useExpenseStore';
import { Check, Download, ExternalLink, FileText, Paperclip, RotateCcw, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { isSupabaseConfigured, supabase } from '@/lib/supabaseClient';

interface Props {
  catName: string;
  month: string;
  status: CellStatus;
  assignedTo: AssignedTo;
  anchorRect: DOMRect;
  onClose: () => void;
  onSet: (status: CellStatus) => void;
  categoryId?: string;
  monthIndex?: number;
  year?: number;
  documents?: CellDocument[];
  onDocumentsChange?: (documents: CellDocument[]) => void;
}

const STATUS_LABEL: Record<CellStatus, string> = {
  'unpaid': 'Do opłacenia',
  'paid-M': 'M zapłaciła ✓',
  'paid-J': 'J zapłacił ✓',
  'paid-MJ': 'Oboje ✓',
  'not-required': 'Niewymagane',
};

const OPTIONS: { status: CellStatus; label: string; badgeClass: string; badgeText: string }[] = [
  { status: 'paid-M',        label: 'M zapłaciła', badgeClass: 'badge-m',  badgeText: 'M' },
  { status: 'paid-J',        label: 'J zapłacił',  badgeClass: 'badge-j',  badgeText: 'J' },
  { status: 'paid-MJ',       label: 'M+J (oboje)', badgeClass: 'badge-mj', badgeText: 'M+J' },
  { status: 'not-required',  label: 'Niewymagane', badgeClass: '',         badgeText: '·' },
];

function cleanFileName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 90) || 'dokument';
}

function cleanPathPart(value: string) {
  return cleanFileName(value).toLowerCase();
}

function fmtSize(size?: number) {
  if (!size) return '';
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function CellEditPopover({
  catName,
  month,
  status,
  anchorRect,
  onClose,
  onSet,
  categoryId,
  monthIndex,
  year,
  documents = [],
  onDocumentsChange,
}: Props) {
  const [expandedDocs, setExpandedDocs] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [transferTitle, setTransferTitle] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [documentDate, setDocumentDate] = useState('');
  const [note, setNote] = useState('');
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement | null>(null);

  const W = expandedDocs ? 360 : 248;
  const H = expandedDocs ? 560 : 320;
  let left = anchorRect.left;
  let top  = anchorRect.bottom + 6;

  if (left + W > window.innerWidth - 8) left = window.innerWidth - W - 8;
  if (left < 8) left = 8;
  if (top + H > window.innerHeight - 8) top = anchorRect.top - H - 6;
  if (top < 8) top = 8;

  useEffect(() => {
    if (!expandedDocs || !supabase || documents.length === 0) return;
    let cancelled = false;
    Promise.all(
      documents.map(async (doc) => {
        const { data, error } = await supabase.storage.from('documents').createSignedUrl(doc.path, 60 * 10);
        return error || !data?.signedUrl ? [doc.id, ''] : [doc.id, data.signedUrl];
      })
    ).then(entries => {
      if (cancelled) return;
      setSignedUrls(Object.fromEntries(entries));
    });
    return () => { cancelled = true; };
  }, [documents, expandedDocs]);

  async function uploadDocument(file: File) {
    if (!supabase || !isSupabaseConfigured) {
      toast.error('Najpierw skonfiguruj i zaloguj chmurę Supabase');
      return;
    }
    if (!categoryId || monthIndex === undefined || !year || !onDocumentsChange) return;
    if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Dozwolone są PDF, JPG, PNG i WEBP');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Plik jest za duży. Maksymalnie 10 MB');
      return;
    }

    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) {
        toast.error('Zaloguj się w Chmurze przed dodaniem dokumentu');
        return;
      }

      const fiscal = `${year}-${String(year + 1).slice(2)}`;
      const safeMonth = cleanPathPart(month);
      const safeCat = cleanPathPart(catName || categoryId);
      const safeName = cleanFileName(file.name);
      const id = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const path = `${user.id}/${fiscal}/${safeMonth}/${safeCat}/${id}-${safeName}`;

      const { error } = await supabase.storage.from('documents').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || undefined,
      });
      if (error) throw error;

      const doc: CellDocument = {
        id,
        path,
        name: file.name,
        mimeType: file.type,
        size: file.size,
        title: title.trim() || undefined,
        transferTitle: transferTitle.trim() || undefined,
        invoiceNumber: invoiceNumber.trim() || undefined,
        amount: amount.trim() ? Number(amount.replace(',', '.')) : undefined,
        documentDate: documentDate || undefined,
        note: note.trim() || undefined,
        createdAt: new Date().toISOString(),
      };
      onDocumentsChange([...documents, doc]);
      setTitle('');
      setTransferTitle('');
      setInvoiceNumber('');
      setAmount('');
      setDocumentDate('');
      setNote('');
      if (fileRef.current) fileRef.current.value = '';
      toast.success('Dokument dodany');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się dodać dokumentu');
    } finally {
      setBusy(false);
    }
  }

  async function removeDocument(doc: CellDocument) {
    if (!onDocumentsChange) return;
    if (!confirm(`Usunąć dokument „${doc.title || doc.name}”?`)) return;
    setBusy(true);
    try {
      if (supabase) await supabase.storage.from('documents').remove([doc.path]);
      onDocumentsChange(documents.filter(d => d.id !== doc.id));
      toast.success('Dokument usunięty');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się usunąć dokumentu');
    } finally {
      setBusy(false);
    }
  }

  function openDoc(doc: CellDocument) {
    const url = signedUrls[doc.id];
    if (!url) {
      toast.info('Link jest jeszcze przygotowywany. Otwórz dokument za chwilę.');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return createPortal(
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 bg-card border border-border rounded-2xl shadow-xl overflow-hidden"
        style={{ top, left, width: W, maxHeight: 'calc(100vh - 16px)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-3.5 py-2.5 bg-muted/50 border-b border-border">
          <p className="text-xs font-bold text-foreground">⚙️ {catName} · {month}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Aktualnie: {STATUS_LABEL[status]}</p>
        </div>

        <div className="max-h-[calc(100vh-110px)] overflow-y-auto category-scroll">
          <div className="p-1.5 space-y-0.5">
            <p className="px-2 pt-1 pb-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              Oznacz jako opłacone przez:
            </p>
            {OPTIONS.map(opt => (
              <button
                key={opt.status}
                onClick={() => { onSet(opt.status); onClose(); }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium transition-colors ${status === opt.status ? 'bg-muted' : 'hover:bg-muted/60'}`}
              >
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 min-w-[22px] text-center ${opt.badgeClass || 'bg-muted text-muted-foreground'}`}>
                  {opt.badgeText}
                </span>
                <span className="flex-1 text-left text-foreground">{opt.label}</span>
                {status === opt.status && <Check className="h-3 w-3 text-muted-foreground shrink-0" />}
              </button>
            ))}
          </div>

          <div className="px-1.5 pb-1.5 pt-0.5 border-t border-border">
            <button
              onClick={() => setExpandedDocs(v => !v)}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium hover:bg-muted/60 transition-colors"
            >
              <Paperclip className="h-3.5 w-3.5 text-primary" />
              <span className="flex-1 text-left">Dokumenty</span>
              <span className="text-[10px] rounded-full bg-primary/15 text-primary px-1.5 py-0.5">{documents.length}</span>
            </button>

            {expandedDocs && (
              <div className="mt-2 space-y-3 rounded-xl border border-border bg-background/60 p-2">
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Dodaj dokument</p>
                  <input className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs" placeholder="Tytuł, np. Faktura Tauron" value={title} onChange={e => setTitle(e.target.value)} />
                  <input className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs" placeholder="Tytuł przelewu" value={transferTitle} onChange={e => setTransferTitle(e.target.value)} />
                  <div className="grid grid-cols-2 gap-1.5">
                    <input className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs" placeholder="Nr faktury" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} />
                    <input className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs" inputMode="decimal" placeholder="Kwota" value={amount} onChange={e => setAmount(e.target.value)} />
                  </div>
                  <input className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs" type="date" value={documentDate} onChange={e => setDocumentDate(e.target.value)} />
                  <textarea className="w-full min-h-[52px] rounded-lg border border-border bg-background px-2 py-1.5 text-xs resize-none" placeholder="Notatka do dokumentu" value={note} onChange={e => setNote(e.target.value)} />
                  <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/15 ${busy ? 'pointer-events-none opacity-60' : ''}`}>
                    <Upload className="h-3.5 w-3.5" /> Dodaj PDF / zdjęcie
                    <input ref={fileRef} type="file" className="hidden" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={e => { const f = e.currentTarget.files?.[0]; if (f) uploadDocument(f); }} />
                  </label>
                  {!isSupabaseConfigured && <p className="text-[10px] text-destructive">Brakuje konfiguracji Supabase.</p>}
                </div>

                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Podpięte dokumenty</p>
                  {documents.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border px-2 py-3 text-center text-[11px] text-muted-foreground">Brak dokumentów przy tej płatności.</p>
                  ) : documents.map(doc => (
                    <div key={doc.id} className="rounded-xl border border-border bg-card/70 p-2">
                      <div className="flex items-start gap-2">
                        <FileText className="mt-0.5 h-3.5 w-3.5 text-primary shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-foreground">{doc.title || doc.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{doc.name} {fmtSize(doc.size) && `· ${fmtSize(doc.size)}`}</p>
                          {doc.transferTitle && <p className="text-[10px] text-muted-foreground mt-1"><b>Tytuł:</b> {doc.transferTitle}</p>}
                          <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                            {doc.invoiceNumber && <span>Nr: {doc.invoiceNumber}</span>}
                            {doc.amount !== undefined && <span>{doc.amount.toLocaleString('pl-PL')} zł</span>}
                            {doc.documentDate && <span>{doc.documentDate}</span>}
                          </div>
                          {doc.note && <p className="mt-1 text-[10px] text-muted-foreground">{doc.note}</p>}
                        </div>
                      </div>
                      <div className="mt-2 flex gap-1.5">
                        <button onClick={() => openDoc(doc)} className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-border px-2 py-1.5 text-[11px] hover:bg-muted">
                          <ExternalLink className="h-3 w-3" /> Otwórz
                        </button>
                        <a href={signedUrls[doc.id] || '#'} download={doc.name} onClick={e => { if (!signedUrls[doc.id]) e.preventDefault(); }} className="flex items-center justify-center rounded-lg border border-border px-2 py-1.5 text-[11px] hover:bg-muted">
                          <Download className="h-3 w-3" />
                        </a>
                        <button onClick={() => removeDocument(doc)} disabled={busy} className="flex items-center justify-center rounded-lg border border-destructive/30 px-2 py-1.5 text-[11px] text-destructive hover:bg-destructive/10">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="px-1.5 pb-1.5 pt-0.5 border-t border-border">
            <p className="px-2 pt-1.5 pb-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Strefa zagrożenia</p>
            <button
              onClick={() => { onSet('unpaid'); onClose(); }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5 shrink-0" />
              <span>🔓 Resetuj / Usuń wpis</span>
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
