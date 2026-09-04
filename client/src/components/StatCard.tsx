interface Props {
  label: string;
  value: string;
  delta?: string;
  tone?: 'fire' | 'neutral';
}

export default function StatCard({ label, value, delta, tone = 'neutral' }: Props) {
  return (
    <div className="group relative bg-surface rounded-2xl border border-line p-4 sm:p-5 flex flex-col gap-2 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden">
      <span
        className={`absolute top-0 left-0 right-0 h-0.5 ${tone === 'fire' ? 'bg-gradient-to-r from-[#ec3013] to-[#ffb199]' : 'bg-gradient-to-r from-ink-faint/30 to-transparent'}`}
      />
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{label}</div>
      <div className="font-[Manrope] font-extrabold text-2xl text-ink tabular-nums">{value}</div>
      {delta && (
        <span
          className={`self-start text-[11px] font-bold px-2 py-0.5 rounded-full ${
            tone === 'fire' ? 'bg-fire-100 text-fire-900' : 'bg-line-soft text-ink-soft'
          }`}
        >
          {delta}
        </span>
      )}
    </div>
  );
}
