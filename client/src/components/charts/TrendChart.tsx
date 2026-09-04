interface Props {
  labels: string[];
  values: number[];
  color?: string;
  height?: number;
}

export default function TrendChart({ labels, values, color = '#ec3013', height = 150 }: Props) {
  const w = 600;
  const h = height;
  const max = Math.max(1, ...values);
  const n = values.length;
  const pt = (v: number, i: number) => [n > 1 ? (i / (n - 1)) * w : w / 2, h - (v / max) * (h - 16) - 8] as const;
  const linePath = values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${pt(v, i).join(',')}`).join(' ');
  const areaPath = `${linePath} L ${w},${h} L 0,${h} Z`;

  if (values.every((v) => v === 0)) {
    return <div className="h-[150px] flex items-center justify-center text-xs text-ink-faint">No detections in this window</div>;
  }

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none">
        <path d={areaPath} fill={color} opacity={0.12} stroke="none" />
        <path d={linePath} fill="none" stroke={color} strokeWidth={2.5} />
        {values.map((v, i) => {
          const [x, y] = pt(v, i);
          return <circle key={i} cx={x} cy={y} r={2.6} fill={color} />;
        })}
      </svg>
      <div className="flex justify-between text-[10px] text-ink-faint mt-1 px-0.5">
        {labels.map((l, i) => (
          <span key={i} className={n > 8 && i % 2 !== 0 ? 'opacity-0' : ''}>
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}
