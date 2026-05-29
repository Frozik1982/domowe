import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileDown, Printer } from 'lucide-react';
import { type StoreData, type CellStatus } from '@/hooks/useExpenseStore';

const MONTHS = [
  'Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik',
  'Listopad','Grudzień','Styczeń','Luty','Marzec','Kwiecień',
];

const CELL_LABEL: Record<CellStatus, string> = {
  'unpaid': '—', 'paid-M': 'M✓', 'paid-J': 'J✓', 'paid-MJ': '✓', 'not-required': '·',
};

const CELL_STYLE: Record<CellStatus, string> = {
  'unpaid':       'color:#bbb;',
  'paid-M':       'background:#dbeafe;color:#1d4ed8;font-weight:700;',
  'paid-J':       'background:#ede9fe;color:#6d28d9;font-weight:700;',
  'paid-MJ':      'background:#dcfce7;color:#166534;font-weight:700;',
  'not-required': 'color:#ddd;',
};

const PAID_SET = new Set<CellStatus>(['paid-M', 'paid-J', 'paid-MJ']);

function buildPdfHtml(data: StoreData): string {
  const { year, categories, cells } = data;
  const endYear = year + 1;

  function getStatus(catId: string, mi: number): CellStatus {
    return cells.find(c => c.categoryId === catId && c.monthIndex === mi)?.status ?? 'unpaid';
  }

  const totalPaid = cells.filter(c => PAID_SET.has(c.status)).length;
  const today = new Date().toLocaleDateString('pl-PL', { day: '2-digit', month: 'long', year: 'numeric' });

  const headerCells = categories.map(cat => {
    const colorBar = cat.color
      ? `<div style="height:3px;background:${cat.color};border-radius:2px;margin-bottom:4px;"></div>`
      : '';
    const dot = cat.color
      ? `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${cat.color};margin-right:3px;vertical-align:middle;"></span>`
      : '';
    const amount = cat.amount > 0
      ? `<br><span style="font-weight:400;color:#999;font-size:8px;">${cat.amount.toLocaleString('pl-PL')} zł</span>`
      : '';
    return `<th style="padding:5px 3px;border-bottom:2px solid #e5e7eb;text-align:center;font-size:9px;min-width:52px;max-width:72px;word-wrap:break-word;vertical-align:bottom;">
      ${colorBar}
      <span style="font-weight:700;color:#111;">${dot}${cat.name}</span>${amount}
    </th>`;
  }).join('');

  const bodyRows = MONTHS.map((month, mi) => {
    const dataCells = categories.map(cat => {
      const st = getStatus(cat.id, mi);
      return `<td style="padding:4px 2px;text-align:center;border-bottom:1px solid #f3f4f6;font-size:9px;${CELL_STYLE[st]}">${CELL_LABEL[st]}</td>`;
    }).join('');
    return `<tr>
      <td style="padding:4px 7px;font-size:9px;font-weight:500;color:#374151;border-bottom:1px solid #f3f4f6;background:#fafafa;white-space:nowrap;">${month}</td>
      ${dataCells}
    </tr>`;
  }).join('');

  const footerCells = categories.map(cat => {
    const paid = Array.from({ length: 12 }, (_, i) => getStatus(cat.id, i)).filter(s => PAID_SET.has(s)).length;
    const req  = Array.from({ length: 12 }, (_, i) => getStatus(cat.id, i)).filter(s => s !== 'not-required').length;
    const color = paid === req && req > 0 ? '#16a34a' : '#6b7280';
    return `<td style="padding:5px 2px;text-align:center;font-size:9px;font-weight:700;color:${color};border-top:2px solid #e5e7eb;">${paid}/${req}</td>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <title>Płatności domowe ${year}/${String(endYear).slice(2)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Arial', Helvetica, sans-serif; font-size: 10px; color: #111; background: white; }
    @page { size: A4 landscape; margin: 10mm 13mm; }
    @media print {
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .no-print { display: none !important; }
    }
    .header { padding-bottom: 10px; border-bottom: 2px solid #111; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-end; }
    h1 { font-size: 16px; font-weight: 800; letter-spacing: -0.3px; }
    .meta { font-size: 8px; color: #9ca3af; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; table-layout: auto; }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
    tr { page-break-inside: avoid; }
    .legend { margin-top: 10px; font-size: 8px; color: #9ca3af; display: flex; gap: 14px; flex-wrap: wrap; }
    .print-btn { margin: 16px 0; padding: 8px 20px; background: #111; color: white; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; font-weight: 600; }
    .print-btn:hover { background: #333; }
  </style>
</head>
<body>
  <div class="no-print" style="padding:16px 0;border-bottom:1px solid #e5e7eb;margin-bottom:16px;text-align:center;">
    <button class="print-btn" onclick="window.print()">🖨️ Drukuj / Zapisz jako PDF</button>
    <p style="font-size:11px;color:#9ca3af;margin-top:6px;">Użyj <strong>Ctrl+P</strong> (lub ⌘P) → Drukarka: <strong>Zapisz jako PDF</strong> → Układ: <strong>Poziomy</strong></p>
  </div>

  <div class="header">
    <div>
      <h1>💳 Płatności domowe ${year}/${String(endYear).slice(2)}</h1>
      <p class="meta">Wygenerowano: ${today} &nbsp;·&nbsp; ${categories.length} kategorii &nbsp;·&nbsp; ${totalPaid} opłaconych pozycji</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="padding:5px 7px;border-bottom:2px solid #e5e7eb;text-align:left;font-size:9px;color:#6b7280;font-weight:700;background:#fafafa;white-space:nowrap;">Miesiąc</th>
        ${headerCells}
      </tr>
    </thead>
    <tbody>${bodyRows}</tbody>
    <tfoot>
      <tr style="background:#fafafa;">
        <td style="padding:5px 7px;font-size:9px;font-weight:700;color:#6b7280;border-top:2px solid #e5e7eb;">Suma</td>
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

  const paidCount = data.cells.filter(c => PAID_SET.has(c.status)).length;

  function handleGenerate() {
    setIsGenerating(true);
    const html = buildPdfHtml(data);
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
    setTimeout(() => setIsGenerating(false), 800);
    onOpenChange(false);
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
            Otwiera czysty widok tabeli w nowej karcie — gotowy do wydruku lub zapisu jako PDF.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-3">
          {/* Summary */}
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

          {/* Color preview */}
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
              <li>Kliknij „Generuj PDF" poniżej</li>
              <li>W nowej karcie kliknij przycisk <strong>„Drukuj / Zapisz jako PDF"</strong></li>
              <li>Wybierz drukarkę: <strong>Zapisz jako PDF</strong></li>
              <li>Układ strony: <strong>Poziomy (Landscape)</strong></li>
            </ol>
          </div>
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
