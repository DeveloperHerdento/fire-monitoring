interface Item {
  label: string;
  value: number;
  color?: string;
}

export default function BarList({ items, unit = '' }: { items: Item[]; unit?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (items.every((i) => i.value === 0)) {
    return <div className="py-8 text-center text-xs text-ink-faint">No data yet</div>;
  }
  return (
    <div className="flex flex-col gap-3">
      {items.map((it) => (
        <div key={it.label}>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-ink-soft">{it.label}</span>
            <strong className="text-ink">
              {it.value}
              {unit}
            </strong>
          </div>
          <div className="h-2 bg-line-soft rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${(it.value / max) * 100}%`, background: it.color ?? '#ec3013' }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
