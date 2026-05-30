import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileDown, Printer, ExternalLink } from 'lucide-react';
import { type StoreData, type CellStatus } from '@/hooks/useExpenseStore';

const MONTHS = [
  'Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik',
  'Listopad','Grudzień','Styczeń','Luty','Marzec','Kwiecień',
];

const CELL_LABEL: Record<CellStatus, string> = {
  'unpaid': '—', 'paid-M': 'M✓', 'paid-J': 'J✓', 'paid-MJ': '✓', 'not-required': '·',
};

const CELL_STYLE: Record<CellStatus, string> = {
  'unpaid':       'color:#b45309;background:#fff7ed;',
  'paid-M':       'background:#dbeafe;color:#1d4ed8;font-weight:700;',
  'paid-J':       'background:#ede9fe;color:#6d28d9;font-weight:700;',
  'paid-MJ':      'background:#dcfce7;color:#166534;font-weight:700;',
  'not-required': 'color:#cbd5e1;background:#f8fafc;',
};

const PAID_SET = new Set<CellStatus>(['paid-M', 'paid-J', 'paid-MJ']);

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function safeColor(value: unknown): string {
  const color = String(value ?? '').trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(color) ? color : '#64748b';
}

function buildPdfHtml(data: StoreData): string {
  const { year, categories, cells } = data;
  const endYear = year + 1;

  function getStatus(catId: string, mi: number): CellStatus {
    return cells.find(c => c.categoryId === catId && c.monthIndex === mi)?.status ?? 'unpaid';
  }

  function paidAmount(): number {
    return categories.reduce((sum, cat) => {
      return sum + MONTHS.reduce((monthSum, _month, mi) => {
        return PAID_SET.has(getStatus(cat.id, mi)) ? monthSum + Number(cat.amount || 0) : monthSum;
      }, 0);
    }, 0);
  }

  function requiredAmount(): number {
    return categories.reduce((sum, cat) => {
      return sum + MONTHS.reduce((monthSum, _month, mi) => {
        return getStatus(cat.id, mi) !== 'not-required' ? monthSum + Number(cat.amount || 0) : monthSum;
      }, 0);
    }, 0);
  }

  const totalPaid = cells.filter(c => PAID_SET.has(c.status)).length;
  const totalRequired = categories.length * 12 - cells.filter(c => c.status === 'not-required').length;
  const paidValue = paidAmount();
  const requiredValue = requiredAmount();
  const remainingValue = Math.max(requiredValue - paidValue, 0);
  const today = new Date().toLocaleDateString('pl-PL', { day: '2-digit', month: 'long', year: 'numeric' });
  const money = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 0 });

  const headerCells = categories.map(cat => {
    const color = safeColor(cat.color);
    const colorBar = cat.color
      ? `<div style="height:3px;background:${color};border-radius:2px;margin-bottom:4px;"></div>`
      : '';
    const dot = cat.color
      ? `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${color};margin-right:3px;vertical-align:middle;"></span>`
      : '';
    const amount = Number(cat.amount || 0) > 0
      ? `<br><span style="font-weight:400;color:#64748b;font-size:8px;">${escapeHtml(money.format(Number(cat.amount || 0)))}</span>`
      : '';
    return `<th style="padding:5px 3px;border-bottom:2px solid #e5e7eb;text-align:center;font-size:9px;min-width:52px;max-width:72px;word-wrap:break-word;vertical-align:bottom;">
      ${colorBar}
      <span style="font-weight:700;color:#111827;">${dot}${escapeHtml(cat.name)}</span>${amount}
    </th>`;
  }).join('');

  const bodyRows = MONTHS.map((month, mi) => {
    const dataCells = categories.map(cat => {
      const st = getStatus(cat.id, mi);
      return `<td style="padding:4px 2px;text-align:center;border-bottom:1px solid #f3f4f6;font-size:9px;${CELL_STYLE[st]}">${CELL_LABEL[st]}</td>`;
    }).join('');
    return `<tr>
      <td style="padding:4px 7px;font-size:9px;font-weight:600;color:#374151;border-bottom:1px solid #f3f4f6;background:#f8fafc;white-space:nowrap;">${escapeHtml(month)}</td>
      ${dataCells}
    </tr>`;
  }).join('');

  const footerCells = categories.map(cat => {
    const paid = Array.from({ length: 12 }, (_, i) => getStatus(cat.id, i)).filter(s => PAID_SET.has(s)).length;
    const req  = Array.from({ length: 12 }, (_, i) => getStatus(cat.id, i)).filter(s => s !== 'not-required').length;
    const color = paid === req && req > 0 ? '#16a34a' : '#6b7280';
    return `<td style="padding:5px 2px;text-align:center;font-size:9px;font-weight:700;color:${color};border-top:2px solid #e5e7eb;background:#f8fafc;">${paid}/${req}</td>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Płatności domowe ${year}/${String(endYear).slice(2)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #111827; background: white; padding: 0; }
    @page { size: A4 landscape; margin: 10mm 13mm; }
    @media print {
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .no-print { display: none !important; }
      body { padding: 0; }
    }
    .no-print { padding: 18px 16px; border-bottom: 1px solid #e5e7eb; margin-bottom: 16px; text-align: center; background: #f8fafc; }
    .print-btn { margin: 0; padding: 9px 20px; background: #111827; color: white; border: none; border-radius: 8px; font-size: 13px; cursor: pointer; font-weight: 700; }
    .print-btn:hover { background: #374151; }
    .print-hint { font-size: 11px; color: #64748b; margin-top: 8px; }
    .page { padding: 0; }
    .header { padding-bottom: 10px; border-bottom: 2px solid #111827; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: flex-end; }
    h1 { font-size: 17px; font-weight: 800; letter-spacing: -0.3px; }
    .meta { font-size: 8px; color: #64748b; margin-top: 3px; }
    .summary { display: flex; gap: 8px; margin: 8px 0 12px; }
    .summary-box { flex: 1; border: 1px solid #e5e7eb; border-radius: 8px; padding: 7px 9px; background: #f8fafc; }
    .summary-label { color: #64748b; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; }
    .summary-value { font-size: 13px; font-weight: 800; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; table-layout: auto; }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
    tr { page-break-inside: avoid; }
    .legend { margin-top: 10px; font-size: 8px; color: #64748b; display: flex; gap: 14px; flex-wrap: wrap; }
  </style>
</head>
<body>
  <div class="no-print">
    <button class="print-btn" onclick="window.print()">🖨️ Drukuj / Zapisz jako PDF</button>
    <p class="print-hint">Użyj <strong>Ctrl+P</strong> → Drukarka: <strong>Zapisz jako PDF</strong> → Układ: <strong>Poziomy</strong></p>
  </div>

  <div class="page">
    <div class="header">
      <div>
        <h1>💳 Płatności domowe ${year}/${String(endYear).slice(2)}</h1>
        <p class="meta">Wygenerowano: ${escapeHtml(today)} &nbsp;·&nbsp; ${categories.length} kategorii &nbsp;·&nbsp; ${totalPaid}/${totalRequired} opłaconych pozycji</p>
      </div>
    </div>

    <div class="summary">
      <div class="summary-box"><div class="summary-label">Opłacone</div><div class="summary-value" style="color:#16a34a;">${escapeHtml(money.format(paidValue))}</div></div>
      <div class="summary-box"><div class="summary-label">Pozostało</div><div class="summary-value" style="color:#dc2626;">${escapeHtml(money.format(remainingValue))}</div></div>
      <div class="summary-box"><div class="summary-label">Razem</div><div class="summary-value">${escapeHtml(money.format(requiredValue))}</div></div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="padding:5px 7px;border-bottom:2px solid #e5e7eb;text-align:left;font-size:9px;color:#6b7280;font-weight:700;background:#f8fafc;white-space:nowrap;">Miesiąc</th>
          ${headerCells}
        </tr>
      </thead>
      <tbody>${bodyRows}</tbody>
      <tfoot>
        <tr>
          <td style="padding:5px 7px;font-size:9px;font-weight:700;color:#6b7280;border-top:2px solid #e5e7eb;background:#f8fafc;">Suma</td>
          ${footerCells}
        </tr>
      </tfoot>
    </table>

    <div class="legend">
      <span>M✓ = M zapłacił</span>
      <span>J✓ = J zapłaciła</span>
      <span>✓ = Oboje zapłacili</span>
      <span>— = Do opłacenia</span>
      <span>· = Niewymagane</span>
    </div>
  </div>
</body>
</html>`;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: StoreData;
}

export default function PdfExportDialog({ open, onOpenChange, data }: Props) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);

  const paidCount = data.cells.filter(c => PAID_SET.has(c.status)).length;
  const pdfHtml = useMemo(() => buildPdfHtml(data), [data]);

  function openPrintableView(url: string): boolean {
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (win) {
      win.focus?.();
      return true;
    }

    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return false;
  }

  function handleGenerate() {
    setIsGenerating(true);

    const blob = new Blob([pdfHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const opened = openPrintableView(url);

    setFallbackUrl(url);
    setIsGenerating(false);

    if (opened) {
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="h-4 w-4" />
            Eksport zestawienia do PDF
          </DialogTitle>
          <DialogDescription>
            Otwiera czysty widok tabeli w nowej karcie. W nowej karcie użyj przycisku drukowania albo Ctrl+P.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-3">
          <div className="bg-muted rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Rok rozliczeniowy</span>
              <span className="font-semibold">{data.year}/{String(data.year + 1).slice(2)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Liczba kategorii</span>
              <span className="font-semibold">{data.categories.length}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Opłacone pozycje</span>
              <span className="font-semibold text-green-600 dark:text-green-400">{paidCount}</span>
            </div>
          </div>

          {data.categories.some(c => c.color) && (
            <div className="bg-muted/50 rounded-xl p-3 flex flex-wrap gap-2 items-center">
              <span className="text-xs text-muted-foreground">Kolory kategorii:</span>
              {data.categories.filter(c => c.color).map(c => (
                <span key={c.id} className="flex items-center gap-1 text-xs">
                  <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                  {c.name}
                </span>
              ))}
            </div>
          )}

          <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-xs text-foreground space-y-1">
            <p className="font-medium">📄 Jak zapisać jako PDF:</p>
            <ol className="list-decimal list-inside space-y-0.5 text-muted-foreground">
              <li>Kliknij „Generuj PDF” poniżej</li>
              <li>W nowej karcie kliknij <strong>„Drukuj / Zapisz jako PDF”</strong> albo użyj <strong>Ctrl+P</strong></li>
              <li>Wybierz drukarkę: <strong>Zapisz jako PDF</strong></li>
              <li>Układ strony: <strong>Poziomy (Landscape)</strong></li>
            </ol>
          </div>

          {fallbackUrl && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200 space-y-2">
              <p>Jeśli nowa karta się nie otworzyła, przeglądarka mogła zablokować wyskakujące okno.</p>
              <a
                href={fallbackUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold underline"
              >
                Otwórz widok PDF ręcznie <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Anuluj</Button>
          <Button size="sm" onClick={handleGenerate} disabled={isGenerating} className="gap-2">
            <Printer className="h-3.5 w-3.5" />
            {isGenerating ? 'Generuję…' : 'Generuj PDF'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
