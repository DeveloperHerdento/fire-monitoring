import { formatAcqDate } from '../lib/format';

interface Props {
  dates: string[]; // continuous calendar range for the selected window, ascending, max = MAX_DAY_RANGE
  counts: Record<string, number>;
  selected: string | 'all';
  onSelect: (d: string | 'all') => void;
}

export default function BottomTimeline({ dates, counts, selected, onSelect }: Props) {
  if (dates.length === 0) return null;

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="absolute bottom-4 left-4 right-4 z-[400] bg-white/95 backdrop-blur rounded-2xl shadow-lg border border-line px-4 py-2.5 flex items-center gap-1 overflow-x-auto">
      <button
        onClick={() => onSelect('all')}
        className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
          selected === 'all' ? 'bg-[#ec3013] text-white' : 'text-ink-faint hover:text-ink'
        }`}
      >
        All ({total})
      </button>
      <span className="w-px h-4 bg-line shrink-0 mx-1" />
      <div className="flex flex-1 items-center justify-center gap-1 min-w-0">
        {dates.map((d) => {
          const count = counts[d] ?? 0;
          const hasData = count > 0;
          return (
            <button
              key={d}
              onClick={() => onSelect(d)}
              disabled={!hasData}
              title={hasData ? `${count} detection${count === 1 ? '' : 's'}` : 'No detections this day'}
              className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-colors ${
                !hasData ? 'text-line cursor-default' : selected === d ? 'text-[#ae1800]' : 'text-ink-faint hover:text-ink'
              }`}
            >
              <span className={selected === d && hasData ? 'border-b-2 border-[#ec3013] pb-0.5 font-bold' : 'pb-0.5'}>{formatAcqDate(d)}</span>
              <span className="text-[10px] font-normal">{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
