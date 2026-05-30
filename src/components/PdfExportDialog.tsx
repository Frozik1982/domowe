import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  FileDown,
  Printer,
  ExternalLink,
  CalendarDays,
  AlertTriangle,
  Table2,
} from "lucide-react";
import { type StoreData, type CellStatus } from "@/hooks/useExpenseStore";
import { usePayerNames } from "@/hooks/usePayerNames";

const MONTHS = [
  "Maj",
  "Czerwiec",
  "Lipiec",
  "Sierpień",
  "Wrzesień",
  "Październik",
  "Listopad",
  "Grudzień",
  "Styczeń",
  "Luty",
  "Marzec",
  "Kwiecień",
];
const PAID_SET = new Set<CellStatus>(["paid-M", "paid-J", "paid-MJ"]);
type PdfRange = "year" | "month" | "due";

const CELL_STYLE: Record<CellStatus, string> = {
  unpaid: "color:#b45309;background:#fff7ed;",
  "paid-M": "background:#dbeafe;color:#1d4ed8;font-weight:700;",
  "paid-J": "background:#ede9fe;color:#6d28d9;font-weight:700;",
  "paid-MJ": "background:#dcfce7;color:#166534;font-weight:700;",
  "not-required": "color:#cbd5e1;background:#f8fafc;",
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function money(v: number): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 2,
  }).format(v || 0);
}

function getCurrentMonthIndex(year: number): number | null {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (y === year && m >= 4) return m - 4;
  if (y === year + 1 && m <= 3) return m + 8;
  return null;
}

function getStatus(
  data: StoreData,
  categoryId: string,
  monthIndex: number,
): CellStatus {
  return (
    data.cells.find(
      (c) => c.categoryId === categoryId && c.monthIndex === monthIndex,
    )?.status ?? "unpaid"
  );
}

function getNote(
  data: StoreData,
  categoryId: string,
  monthIndex: number,
): string {
  return (
    data.cells.find(
      (c) => c.categoryId === categoryId && c.monthIndex === monthIndex,
    )?.note ?? ""
  );
}

function statusLabel(
  status: CellStatus,
  names: { m: string; j: string },
): string {
  if (status === "paid-M") return `${names.m} zapłaciła`;
  if (status === "paid-J") return `${names.j} zapłacił`;
  if (status === "paid-MJ") return "Oboje zapłacili";
  if (status === "not-required") return "Niewymagane";
  return "Do zapłaty";
}

function shortLabel(status: CellStatus): string {
  if (status === "paid-M") return "M✓";
  if (status === "paid-J") return "J✓";
  if (status === "paid-MJ") return "✓";
  if (status === "not-required") return "·";
  return "—";
}

function monthDate(dataYear: number, monthIndex: number): Date {
  return new Date(
    monthIndex < 8 ? dataYear : dataYear + 1,
    monthIndex < 8 ? monthIndex + 4 : monthIndex - 8,
    1,
  );
}

function isDueRelevant(
  data: StoreData,
  categoryId: string,
  monthIndex: number,
  dueDay?: number,
): boolean {
  if (!dueDay) return false;
  const status = getStatus(data, categoryId, monthIndex);
  if (status !== "unpaid") return false;
  const d = monthDate(data.year, monthIndex);
  const due = new Date(d.getFullYear(), d.getMonth(), dueDay);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((due.getTime() - today.getTime()) / 86400000);
  return diff <= 5;
}

function buildBaseHtml(title: string, body: string, landscape = true): string {
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>
    *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;color:#111827;background:white;margin:0;padding:0;font-size:10px}
    @page{size:A4 ${landscape ? "landscape" : "portrait"};margin:10mm 12mm} @media print{*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}.no-print{display:none!important}}
    .no-print{padding:16px;border-bottom:1px solid #e5e7eb;background:#f8fafc;text-align:center;margin-bottom:14px}.print-btn{border:0;border-radius:8px;background:#111827;color:white;padding:9px 18px;font-weight:700;cursor:pointer}.hint{margin-top:7px;color:#64748b;font-size:11px}
    .page{padding:0 2mm}.header{border-bottom:2px solid #111827;margin-bottom:10px;padding-bottom:9px;display:flex;justify-content:space-between;gap:12px;align-items:flex-end}h1{font-size:17px;margin:0}.meta{color:#64748b;font-size:8px;margin-top:3px}.summary{display:flex;gap:8px;margin:8px 0 12px}.box{flex:1;border:1px solid #e5e7eb;border-radius:8px;background:#f8fafc;padding:7px 9px}.lbl{font-size:8px;color:#64748b;text-transform:uppercase;font-weight:700;letter-spacing:.03em}.val{font-size:13px;font-weight:800;margin-top:2px}
    table{width:100%;border-collapse:collapse} th{padding:6px 7px;background:#f8fafc;color:#475569;border-bottom:2px solid #e5e7eb;text-align:left;font-size:9px}td{padding:5px 7px;border-bottom:1px solid #f1f5f9;font-size:9px}.right{text-align:right}.center{text-align:center}.legend{margin-top:10px;font-size:8px;color:#64748b;display:flex;gap:12px;flex-wrap:wrap}.warn{color:#b45309;font-weight:700}.bad{color:#dc2626;font-weight:700}.ok{color:#16a34a;font-weight:700}
  </style></head><body><div class="no-print"><button class="print-btn" onclick="window.print()">🖨️ Drukuj / Zapisz jako PDF</button><div class="hint">Ctrl+P → Zapisz jako PDF → układ ${landscape ? "poziomy" : "pionowy"}</div></div><div class="page">${body}</div></body></html>`;
}

function buildYearHtml(
  data: StoreData,
  names: { m: string; j: string },
): string {
  const title = `Płatności domowe ${data.year}/${String(data.year + 1).slice(2)} — cały rok`;
  let totalRequired = 0,
    totalPaid = 0,
    requiredValue = 0,
    paidValue = 0;
  for (const cat of data.categories)
    for (let mi = 0; mi < 12; mi++) {
      const st = getStatus(data, cat.id, mi);
      if (st !== "not-required") {
        totalRequired++;
        requiredValue += cat.amount || 0;
      }
      if (PAID_SET.has(st)) {
        totalPaid++;
        paidValue += cat.amount || 0;
      }
    }
  const headerCells = data.categories
    .map(
      (c) =>
        `<th class="center">${escapeHtml(c.name)}${c.amount ? `<br><span style="font-weight:400;color:#64748b">${escapeHtml(money(c.amount))}</span>` : ""}</th>`,
    )
    .join("");
  const rows = MONTHS.map(
    (month, mi) =>
      `<tr><td style="font-weight:700;background:#f8fafc">${escapeHtml(month)}</td>${data.categories
        .map((cat) => {
          const st = getStatus(data, cat.id, mi);
          const note = getNote(data, cat.id, mi);
          return `<td class="center" style="${CELL_STYLE[st]}" title="${escapeHtml(note)}">${shortLabel(st)}${note ? " 📝" : ""}</td>`;
        })
        .join("")}</tr>`,
  ).join("");
  const footer = data.categories
    .map((cat) => {
      const paid = Array.from({ length: 12 }, (_, i) =>
        getStatus(data, cat.id, i),
      ).filter((s) => PAID_SET.has(s)).length;
      const req = Array.from({ length: 12 }, (_, i) =>
        getStatus(data, cat.id, i),
      ).filter((s) => s !== "not-required").length;
      return `<td class="center" style="font-weight:700;background:#f8fafc;color:${paid === req && req > 0 ? "#16a34a" : "#64748b"}">${paid}/${req}</td>`;
    })
    .join("");
  const body = `<div class="header"><div><h1>💳 ${escapeHtml(title)}</h1><div class="meta">Wygenerowano: ${escapeHtml(new Date().toLocaleString("pl-PL"))} · ${data.categories.length} kategorii</div></div></div><div class="summary"><div class="box"><div class="lbl">Opłacone</div><div class="val ok">${totalPaid}/${totalRequired}</div></div><div class="box"><div class="lbl">Kwota opłacona</div><div class="val ok">${escapeHtml(money(paidValue))}</div></div><div class="box"><div class="lbl">Pozostało</div><div class="val bad">${escapeHtml(money(Math.max(0, requiredValue - paidValue)))}</div></div></div><table><thead><tr><th>Miesiąc</th>${headerCells}</tr></thead><tbody>${rows}</tbody><tfoot><tr><td style="font-weight:700;background:#f8fafc">Suma</td>${footer}</tr></tfoot></table><div class="legend"><span>M✓ = ${escapeHtml(names.m)} zapłaciła</span><span>J✓ = ${escapeHtml(names.j)} zapłacił</span><span>✓ = Oboje</span><span>— = Do zapłaty</span><span>· = Niewymagane</span><span>📝 = Notatka</span></div>`;
  return buildBaseHtml(title, body, true);
}

function buildListHtml(
  data: StoreData,
  names: { m: string; j: string },
  range: PdfRange,
): string {
  const currentMonth = getCurrentMonthIndex(data.year) ?? 0;
  const rows = data.categories
    .flatMap((cat) =>
      Array.from({ length: 12 }, (_, mi) => ({
        cat,
        mi,
        st: getStatus(data, cat.id, mi),
        note: getNote(data, cat.id, mi),
      })),
    )
    .filter((row) => {
      if (range === "month") return row.mi === currentMonth;
      if (range === "due")
        return isDueRelevant(data, row.cat.id, row.mi, row.cat.dueDay);
      return true;
    });
  const title =
    range === "month"
      ? `Płatności — ${MONTHS[currentMonth]} ${currentMonth < 8 ? data.year : data.year + 1}`
      : "Zaległości i najbliższe terminy";
  const paidValue = rows
    .filter((r) => PAID_SET.has(r.st))
    .reduce((s, r) => s + (r.cat.amount || 0), 0);
  const requiredValue = rows
    .filter((r) => r.st !== "not-required")
    .reduce((s, r) => s + (r.cat.amount || 0), 0);
  const tableRows =
    rows
      .map((r) => {
        const mDate = monthDate(data.year, r.mi);
        let dueText = "";
        let dueClass = "";
        if (r.cat.dueDay) {
          const due = new Date(
            mDate.getFullYear(),
            mDate.getMonth(),
            r.cat.dueDay,
          );
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const diff = Math.ceil((due.getTime() - today.getTime()) / 86400000);
          dueText = `${r.cat.dueDay}. dzień miesiąca`;
          if (r.st === "unpaid" && diff < 0) {
            dueText += ` · zaległe ${Math.abs(diff)} dni`;
            dueClass = "bad";
          } else if (r.st === "unpaid" && diff === 0) {
            dueText += " · dziś";
            dueClass = "warn";
          } else if (r.st === "unpaid" && diff <= 5) {
            dueText += ` · za ${diff} dni`;
            dueClass = "warn";
          }
        }
        return `<tr><td>${escapeHtml(MONTHS[r.mi])}</td><td><strong>${escapeHtml(r.cat.name)}</strong></td><td class="right">${r.cat.amount ? escapeHtml(money(r.cat.amount)) : "—"}</td><td>${escapeHtml(statusLabel(r.st, names))}</td><td class="${dueClass}">${escapeHtml(dueText || "—")}</td><td>${escapeHtml(r.note || "")}</td></tr>`;
      })
      .join("") ||
    '<tr><td colspan="6" style="text-align:center;color:#64748b;padding:18px">Brak pozycji dla wybranego zakresu.</td></tr>';
  const body = `<div class="header"><div><h1>💳 ${escapeHtml(title)}</h1><div class="meta">Rok: ${data.year}/${String(data.year + 1).slice(2)} · wygenerowano: ${escapeHtml(new Date().toLocaleString("pl-PL"))}</div></div></div><div class="summary"><div class="box"><div class="lbl">Pozycji</div><div class="val">${rows.length}</div></div><div class="box"><div class="lbl">Opłacone</div><div class="val ok">${escapeHtml(money(paidValue))}</div></div><div class="box"><div class="lbl">Pozostało</div><div class="val bad">${escapeHtml(money(Math.max(0, requiredValue - paidValue)))}</div></div></div><table><thead><tr><th>Miesiąc</th><th>Kategoria</th><th class="right">Kwota</th><th>Status</th><th>Termin</th><th>Notatka</th></tr></thead><tbody>${tableRows}</tbody></table>`;
  return buildBaseHtml(title, body, false);
}

function buildPdfHtml(
  data: StoreData,
  names: { m: string; j: string },
  range: PdfRange,
): string {
  return range === "year"
    ? buildYearHtml(data, names)
    : buildListHtml(data, names, range);
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: StoreData;
}

export default function PdfExportDialog({ open, onOpenChange, data }: Props) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [range, setRange] = useState<PdfRange>("year");
  const { names } = usePayerNames();
  const paidCount = data.cells.filter((c) => PAID_SET.has(c.status)).length;
  const pdfHtml = useMemo(
    () => buildPdfHtml(data, names, range),
    [data, names, range],
  );

  function openPrintableView(url: string): boolean {
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (win) {
      win.focus?.();
      return true;
    }
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return false;
  }

  function handleGenerate() {
    setIsGenerating(true);
    const blob = new Blob([pdfHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const opened = openPrintableView(url);
    setFallbackUrl(url);
    setIsGenerating(false);
    if (opened) {
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      onOpenChange(false);
    }
  }

  const ranges = [
    {
      value: "year" as PdfRange,
      title: "Cały rok",
      desc: "Pełna tabela 12 miesięcy",
      icon: Table2,
    },
    {
      value: "month" as PdfRange,
      title: "Ten miesiąc",
      desc: "Lista pozycji aktualnego miesiąca",
      icon: CalendarDays,
    },
    {
      value: "due" as PdfRange,
      title: "Zaległości",
      desc: "Zaległe i terminy do 5 dni",
      icon: AlertTriangle,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="h-4 w-4" /> Eksport zestawienia do PDF
          </DialogTitle>
          <DialogDescription>
            Wybierz zakres, a potem zapisz widok jako PDF z nowej karty.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2 space-y-3">
          <div className="grid sm:grid-cols-3 gap-2">
            {ranges.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setRange(item.value)}
                  className={`rounded-xl border p-3 text-left transition-colors ${range === item.value ? "border-primary bg-primary/10" : "border-border bg-muted/20 hover:bg-muted/35"}`}
                >
                  <Icon className="h-4 w-4 text-primary mb-2" />
                  <div className="text-xs font-bold text-foreground">
                    {item.title}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                    {item.desc}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="bg-muted rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Rok rozliczeniowy</span>
              <span className="font-semibold">
                {data.year}/{String(data.year + 1).slice(2)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Liczba kategorii</span>
              <span className="font-semibold">{data.categories.length}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Opłacone pozycje</span>
              <span className="font-semibold text-green-600 dark:text-green-400">
                {paidCount}
              </span>
            </div>
          </div>
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-xs text-foreground space-y-1">
            <p className="font-medium">📄 Jak zapisać jako PDF:</p>
            <ol className="list-decimal list-inside space-y-0.5 text-muted-foreground">
              <li>Kliknij „Generuj PDF”</li>
              <li>
                W nowej karcie kliknij „Drukuj / Zapisz jako PDF” albo Ctrl+P
              </li>
              <li>Wybierz drukarkę „Zapisz jako PDF”</li>
            </ol>
          </div>
          {fallbackUrl && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200 space-y-2">
              <p>
                Jeśli nowa karta się nie otworzyła, przeglądarka mogła
                zablokować wyskakujące okno.
              </p>
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Anuluj
          </Button>
          <Button
            size="sm"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="gap-2"
          >
            <Printer className="h-3.5 w-3.5" />
            {isGenerating ? "Generuję…" : "Generuj PDF"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
