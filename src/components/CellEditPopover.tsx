import { createPortal } from 'react-dom';
import { type CellStatus, type AssignedTo } from '@/hooks/useExpenseStore';
import { Check, RotateCcw } from 'lucide-react';

interface Props {
  catName: string;
  month: string;
  status: CellStatus;
  assignedTo: AssignedTo;
  anchorRect: DOMRect;
  onClose: () => void;
  onSet: (status: CellStatus) => void;
}

const STATUS_LABEL: Record<CellStatus, string> = {
  'unpaid': 'Do opłacenia',
  'paid-M': 'M zapłacił ✓',
  'paid-J': 'J zapłaciła ✓',
  'paid-MJ': 'Oboje ✓',
  'not-required': 'Niewymagane',
};

const OPTIONS: { status: CellStatus; label: string; badgeClass: string; badgeText: string }[] = [
  { status: 'paid-M',        label: 'M zapłacił',   badgeClass: 'badge-m',  badgeText: 'M' },
  { status: 'paid-J',        label: 'J zapłaciła',  badgeClass: 'badge-j',  badgeText: 'J' },
  { status: 'paid-MJ',       label: 'M+J (oboje)',  badgeClass: 'badge-mj', badgeText: 'M+J' },
  { status: 'not-required',  label: 'Niewymagane',  badgeClass: '',         badgeText: '·' },
];

export default function CellEditPopover({ catName, month, status, anchorRect, onClose, onSet }: Props) {
  // Fixed-position calculation (anchorRect is already viewport-relative)
  const W = 232, H = 270;
  let left = anchorRect.left;
  let top  = anchorRect.bottom + 6;

  if (left + W > window.innerWidth - 8)  left = window.innerWidth - W - 8;
  if (left < 8)                           left = 8;
  if (top  + H > window.innerHeight - 8) top  = anchorRect.top - H - 6;
  if (top  < 8)                           top  = 8;

  return createPortal(
    <>
      {/* Transparent backdrop — click to close */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Popover card */}
      <div
        className="fixed z-50 bg-card border border-border rounded-2xl shadow-xl overflow-hidden"
        style={{ top, left, width: W }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-3.5 py-2.5 bg-muted/50 border-b border-border">
          <p className="text-xs font-bold text-foreground">⚙️ {catName} · {month}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Aktualnie: {STATUS_LABEL[status]}</p>
        </div>

        {/* Status options */}
        <div className="p-1.5 space-y-0.5">
          <p className="px-2 pt-1 pb-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            Oznacz jako opłacone przez:
          </p>
          {OPTIONS.map(opt => (
            <button
              key={opt.status}
              onClick={() => { onSet(opt.status); onClose(); }}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium transition-colors
                ${status === opt.status ? 'bg-muted' : 'hover:bg-muted/60'}`}
            >
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 min-w-[22px] text-center
                ${opt.badgeClass || 'bg-muted text-muted-foreground'}`}>
                {opt.badgeText}
              </span>
              <span className="flex-1 text-left text-foreground">{opt.label}</span>
              {status === opt.status && <Check className="h-3 w-3 text-muted-foreground shrink-0" />}
            </button>
          ))}
        </div>

        {/* Danger zone */}
        <div className="px-1.5 pb-1.5 pt-0.5 border-t border-border">
          <p className="px-2 pt-1.5 pb-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            Strefa zagrożenia
          </p>
          <button
            onClick={() => { onSet('unpaid'); onClose(); }}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5 shrink-0" />
            <span>🔓 Resetuj / Usuń wpis</span>
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}
