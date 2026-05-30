import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { type CellStatus } from "@/hooks/useExpenseStore";
import { Check, RotateCcw, StickyNote, X } from "lucide-react";

interface Props {
  catName: string;
  month: string;
  status: CellStatus;
  note?: string;
  names: { m: string; j: string };
  anchorRect: DOMRect;
  onClose: () => void;
  onSet: (status: CellStatus) => void;
  onSetNote: (note: string) => void;
}

function statusLabel(
  status: CellStatus,
  names: { m: string; j: string },
): string {
  if (status === "paid-M") return `${names.m} zapłaciła ✓`;
  if (status === "paid-J") return `${names.j} zapłacił ✓`;
  if (status === "paid-MJ") return "Oboje ✓";
  if (status === "not-required") return "Niewymagane";
  return "Do opłacenia";
}

function options(names: { m: string; j: string }) {
  return [
    {
      status: "paid-M" as CellStatus,
      label: `${names.m} zapłaciła`,
      badgeClass: "badge-m",
      badgeText: names.m.slice(0, 3) || "M",
    },
    {
      status: "paid-J" as CellStatus,
      label: `${names.j} zapłacił`,
      badgeClass: "badge-j",
      badgeText: names.j.slice(0, 3) || "J",
    },
    {
      status: "paid-MJ" as CellStatus,
      label: "Oboje zapłacili",
      badgeClass: "badge-mj",
      badgeText: "M+J",
    },
    {
      status: "not-required" as CellStatus,
      label: "Niewymagane",
      badgeClass: "",
      badgeText: "·",
    },
  ];
}

export default function CellEditPopover({
  catName,
  month,
  status,
  note = "",
  names,
  anchorRect,
  onClose,
  onSet,
  onSetNote,
}: Props) {
  const [noteDraft, setNoteDraft] = useState(note);
  const W = 280;
  const H = 390;
  let left = anchorRect.left;
  let top = anchorRect.bottom + 8;

  if (left + W > window.innerWidth - 8) left = window.innerWidth - W - 8;
  if (left < 8) left = 8;
  if (top + H > window.innerHeight - 8) top = anchorRect.top - H - 8;
  if (top < 8) top = 8;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return createPortal(
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
        style={{ top, left, width: W }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3.5 py-2.5 bg-muted/50 border-b border-border flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-foreground truncate">
              {catName} · {month}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Aktualnie: {statusLabel(status, names)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
            title="Zamknij"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="p-1.5 space-y-0.5">
          <p className="px-2 pt-1 pb-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            Szybkie oznaczenie
          </p>
          {options(names).map((opt) => (
            <button
              key={opt.status}
              onClick={() => {
                onSet(opt.status);
                onClose();
              }}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium transition-colors ${status === opt.status ? "bg-muted" : "hover:bg-muted/60"}`}
            >
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 min-w-[28px] text-center ${opt.badgeClass || "bg-muted text-muted-foreground"}`}
              >
                {opt.badgeText}
              </span>
              <span className="flex-1 text-left text-foreground truncate">
                {opt.label}
              </span>
              {status === opt.status && (
                <Check className="h-3 w-3 text-muted-foreground shrink-0" />
              )}
            </button>
          ))}
        </div>

        <div className="px-3 py-2 border-t border-border bg-muted/10 space-y-2">
          <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <StickyNote className="h-3 w-3" /> Notatka do płatności
          </label>
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="Np. numer faktury, przelew, uwagi..."
            className="w-full min-h-[70px] resize-none rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/40"
            maxLength={220}
          />
          <div className="flex justify-between items-center gap-2">
            <span className="text-[10px] text-muted-foreground">
              {noteDraft.length}/220
            </span>
            <button
              onClick={() => {
                onSetNote(noteDraft.trim());
                onClose();
              }}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Zapisz notatkę
            </button>
          </div>
        </div>

        <div className="px-1.5 pb-1.5 pt-1.5 border-t border-border">
          <button
            onClick={() => {
              onSet("unpaid");
              onClose();
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5 shrink-0" />
            <span>Resetuj do „Do zapłaty”</span>
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
