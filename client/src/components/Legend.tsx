interface Item {
  color: string;
  label: string;
}

export default function Legend({ title, items }: { title: string; items: Item[] }) {
  return (
    <div className="bg-surface/95 backdrop-blur rounded-xl shadow-lg border border-line px-3.5 py-3 min-w-[160px]">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint mb-2">{title}</div>
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-2 text-[11px] font-semibold text-ink mb-1.5 last:mb-0">
          <span className="w-2.5 h-2.5 shrink-0" style={{ background: it.color }} />
          {it.label}
        </div>
      ))}
    </div>
  );
}
