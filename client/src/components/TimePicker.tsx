import { useEffect, useRef, useState } from 'react';

interface Props {
  value: string; // HH:MM, 24-hour
  onChange: (value: string) => void;
  className?: string;
}

const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1); // 1-12

function to12h(value: string): { hour: number; pm: boolean } {
  const [h] = value.split(':').map(Number);
  const pm = h >= 12;
  let hour = h % 12;
  if (hour === 0) hour = 12;
  return { hour, pm };
}

// Hour-only picker — always lands on the top of the hour.
function to24h(hour: number, pm: boolean): string {
  let h = hour % 12;
  if (pm) h += 12;
  return `${String(h).padStart(2, '0')}:00`;
}

export default function TimePicker({ value, onChange, className }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { hour, pm } = to12h(value);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const set = (next: Partial<{ hour: number; pm: boolean }>) => {
    onChange(to24h(next.hour ?? hour, next.pm ?? pm));
  };

  return (
    <div ref={rootRef} className={`relative ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-center gap-1.5 border rounded-full px-3 py-1.5 text-xs font-semibold bg-white transition-colors ${
          open ? 'border-[#ec3013] ring-2 ring-[#ec3013]/25' : 'border-line hover:border-ink-faint'
        }`}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink-faint shrink-0">
          <circle cx="12" cy="12" r="9" />
          <polyline points="12 7 12 12 15.5 14" />
        </svg>
        <span className="text-ink tabular-nums">{String(hour).padStart(2, '0')}:00</span>
        <span className="text-[10px] font-bold text-[#ec3013]">{pm ? 'PM' : 'AM'}</span>
      </button>

      {open && (
        <div className="absolute z-1000 top-[calc(100%+8px)] left-0 bg-white rounded-2xl shadow-xl border border-line p-2 flex gap-1 w-28 origin-top-left animate-[fadeIn_.12s_ease-out]">
          <TimeColumn items={HOURS_12} selected={hour} format={(n) => String(n).padStart(2, '0')} onSelect={(n) => set({ hour: n })} />
          <div className="w-px bg-line-soft my-1" />
          <TimeColumn items={[false, true]} selected={pm} format={(v) => (v ? 'PM' : 'AM')} onSelect={(v) => set({ pm: v })} />
        </div>
      )}
    </div>
  );
}

function TimeColumn<T extends string | number | boolean>({
  items,
  selected,
  format,
  onSelect,
}: {
  items: T[];
  selected: T;
  format: (v: T) => string;
  onSelect: (v: T) => void;
}) {
  return (
    <div className="tp-col flex-1 max-h-44 overflow-y-auto flex flex-col gap-0.5 py-0.5 scroll-smooth">
      {items.map((item) => {
        const active = item === selected;
        return (
          <button
            key={String(item)}
            type="button"
            onClick={() => onSelect(item)}
            className={`shrink-0 text-center text-xs font-bold rounded-xl py-1.5 transition-colors tabular-nums ${
              active ? 'bg-[#ec3013] text-white shadow-sm' : 'text-ink-soft hover:bg-canvas'
            }`}
          >
            {format(item)}
          </button>
        );
      })}
    </div>
  );
}
