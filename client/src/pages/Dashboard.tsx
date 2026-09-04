import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAoi } from '../state/AoiContext';
import StatCard from '../components/StatCard';
import FireMapCanvas from '../components/FireMapCanvas';
import Legend from '../components/Legend';
import TrendChart from '../components/charts/TrendChart';
import BarList from '../components/charts/BarList';
import { formatAcqDate, formatWibDate, formatWibTime, relativeTime, tierBg, confidenceLabel } from '../lib/format';
import { formatHa, compassLabel } from '../lib/geo';

export default function Dashboard() {
  const { activeAoi, inAoiHotspots, nearbyHotspots, status, fetchedAt, weather } = useAoi();
  const navigate = useNavigate();

  const confidenceCounts = useMemo(() => {
    const c = { high: 0, nominal: 0, low: 0 };
    inAoiHotspots.forEach((h) => c[h.confidence]++);
    return c;
  }, [inAoiHotspots]);

  const nearest = useMemo(() => {
    if (nearbyHotspots.length === 0) return null;
    return [...nearbyHotspots].sort((a, b) => (a.distanceToBoundaryKm ?? 99) - (b.distanceToBoundaryKm ?? 99))[0];
  }, [nearbyHotspots]);

  const mostRecent = useMemo(() => {
    if (inAoiHotspots.length === 0) return null;
    return [...inAoiHotspots].sort((a, b) => (b.acqDate + b.acqTime).localeCompare(a.acqDate + a.acqTime))[0];
  }, [inAoiHotspots]);

  const trend = useMemo(() => {
    const byDate = new Map<string, number>();
    inAoiHotspots.forEach((h) => byDate.set(h.acqDate, (byDate.get(h.acqDate) ?? 0) + 1));
    const dates = [...byDate.keys()].sort();
    return { labels: dates.map(formatAcqDate), values: dates.map((d) => byDate.get(d)!) };
  }, [inAoiHotspots]);

  if (!activeAoi) {
    return (
      <div className="max-w-md mx-auto text-center py-28 px-6">
        <div className="text-4xl mb-4">🔥</div>
        <h1 className="text-xl font-bold mb-2">No Area of Interest yet</h1>
        <p className="text-sm text-ink-soft mb-6">
          Draw an AOI first — the dashboard, fire map, and analytics all key off live hotspot data fetched inside its boundary.
        </p>
        <button onClick={() => navigate('/field')} className="bg-[#ec3013] hover:bg-[#c22910] text-white font-semibold text-sm rounded-lg px-5 py-2.5">
          Draw your first AOI
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-8 py-5 sm:py-8 pb-8 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 mb-1">
        <h1 className="text-xl sm:text-2xl font-extrabold">Fire Monitoring Dashboard</h1>
        {fetchedAt && <span className="text-xs text-ink-faint">Synced {relativeTime(fetchedAt)} · NASA FIRMS</span>}
      </div>
      <p className="text-ink-soft mb-6 text-sm sm:text-base">Live hotspot summary for <strong className="text-ink">{activeAoi.name}</strong> ({formatHa(activeAoi.areaHa)}).</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
        <StatCard label="Active Hotspots" value={String(inAoiHotspots.length)} delta={status === 'loading' ? 'refreshing…' : 'inside AOI'} tone="fire" />
        <StatCard label="High-Confidence" value={String(confidenceCounts.high)} delta={`${confidenceCounts.nominal} medium · ${confidenceCounts.low} low`} tone="fire" />
        <StatCard
          label="Most Recent Detection"
          value={mostRecent ? formatWibTime(mostRecent.acqDate, mostRecent.acqTime) : '—'}
          delta={mostRecent ? formatWibDate(mostRecent.acqDate, mostRecent.acqTime) : 'none in window'}
        />
        <StatCard
          label="Nearest Outside AOI"
          value={nearest ? `${nearest.distanceToBoundaryKm} km` : '—'}
          delta={nearest ? `${nearest.confidence} confidence` : 'no nearby activity'}
        />
      </div>

      <div className="flex justify-between items-baseline mb-3">
        <h2 className="font-bold text-lg">Fire Map</h2>
        <button onClick={() => navigate('/field')} className="text-xs font-semibold text-[#ec3013] hover:underline">view more →</button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 mb-8">
        <div className="relative h-[280px] sm:h-[360px] lg:h-[420px] rounded-2xl overflow-hidden border border-line shadow-sm">
          <FireMapCanvas ring={activeAoi.ring} hotspots={inAoiHotspots} module="hotspot" showBoundary opacity={90} interactive={false} />
          <div className="absolute top-3 right-3 z-[400]">
            <Legend title="Fire Confidence" items={[{ color: '#ae1800', label: 'HIGH' }, { color: '#ec3013', label: 'MEDIUM' }, { color: '#ffc4b8', label: 'LOW' }]} />
          </div>
        </div>
        <div className="flex flex-col gap-4 lg:h-[420px]">
          <div className="bg-white border border-line rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow duration-200 lg:flex-1 lg:flex lg:flex-col lg:justify-center">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint mb-2.5">AOI Summary</div>
            <Row k="Area" v={formatHa(activeAoi.areaHa)} />
            <Row k="Vertices" v={String(activeAoi.ring.length)} />
            <Row k="In-AOI hotspots" v={String(inAoiHotspots.length)} />
            <Row k="Nearby (outside)" v={String(nearbyHotspots.length)} />
            {weather && (
              <>
                <Row k="Wind" v={`${compassLabel(weather.windDirectionDeg ?? 0)} · ${weather.windSpeedKmh} km/h`} />
                <Row k="Temp / Humidity" v={`${weather.tempC}°C · ${weather.humidityPct}%`} />
              </>
            )}
          </div>
          <div className="bg-white border border-line rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow duration-200 lg:flex-1 lg:flex lg:flex-col lg:justify-center">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint mb-2.5">Confidence Breakdown</div>
            <div className="flex h-2 rounded-full overflow-hidden mb-2.5 bg-line-soft">
              {(['high', 'nominal', 'low'] as const).map((t) => (
                <div key={t} style={{ width: `${inAoiHotspots.length ? (confidenceCounts[t] / inAoiHotspots.length) * 100 : 0}%`, background: tierBg(t).fg }} />
              ))}
            </div>
            {(['high', 'nominal', 'low'] as const).map((t) => (
              <div key={t} className="flex justify-between text-xs mb-1 last:mb-0">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: tierBg(t).fg }} />{confidenceLabel(t)}</span>
                <strong>{confidenceCounts[t]}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      <h2 className="font-bold text-lg mb-3 mt-2">Recent Detections</h2>
      <div className="mb-8 bg-white border border-line rounded-2xl shadow-sm overflow-hidden">
        {inAoiHotspots.length === 0 && (
          <div className="py-8 text-center text-ink-faint text-xs">No hotspots detected in this AOI for the selected time window.</div>
        )}
        {[...inAoiHotspots]
          .sort((a, b) => (b.acqDate + b.acqTime).localeCompare(a.acqDate + a.acqTime))
          .slice(0, 6)
          .map((h, i, arr) => (
            <div
              key={h.id}
              className={`flex items-center gap-3 px-4 py-3.5 hover:bg-canvas transition-colors ${i !== arr.length - 1 ? 'border-b border-line-soft' : ''}`}
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: tierBg(h.confidence).fg }} />
              <div className="min-w-0 flex-1">
                <div className="font-semibold truncate">{confidenceLabel(h.confidence)} confidence detection</div>
                <div className="text-xs text-ink-faint">{h.satellite} {h.instrument} · FRP {h.frp ?? '—'} MW</div>
              </div>
              <div className="text-xs text-ink-faint whitespace-nowrap shrink-0">{formatWibDate(h.acqDate, h.acqTime)} · {formatWibTime(h.acqDate, h.acqTime)}</div>
            </div>
          ))}
      </div>

      <div className="flex justify-between items-baseline mb-3 mt-2">
        <h2 className="font-bold text-lg">Analytics</h2>
        <button onClick={() => navigate('/analytics')} className="text-xs font-semibold text-[#ec3013] hover:underline">view more →</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="border border-line p-4">
          <div className="font-semibold text-sm mb-0.5">Hotspot Trend</div>
          <div className="text-xs text-ink-faint mb-2">Detections per day inside AOI</div>
          <TrendChart labels={trend.labels} values={trend.values} />
        </div>
        <div className="border border-line p-4">
          <div className="font-semibold text-sm mb-0.5">Nearby Activity</div>
          <div className="text-xs text-ink-faint mb-3">Detections outside AOI, by distance band</div>
          <BarList
            items={[
              { label: '< 1 km', value: nearbyHotspots.filter((h) => (h.distanceToBoundaryKm ?? 99) < 1).length, color: '#ae1800' },
              { label: '1 – 3 km', value: nearbyHotspots.filter((h) => (h.distanceToBoundaryKm ?? 99) >= 1 && (h.distanceToBoundaryKm ?? 99) < 3).length, color: '#ec3013' },
              { label: '3 – 5 km', value: nearbyHotspots.filter((h) => (h.distanceToBoundaryKm ?? 99) >= 3 && (h.distanceToBoundaryKm ?? 99) < 5).length, color: '#ffc4b8' },
              { label: '> 5 km', value: nearbyHotspots.filter((h) => (h.distanceToBoundaryKm ?? 99) >= 5).length, color: '#e2c4be' },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between text-sm mb-1.5 last:mb-0">
      <span className="text-ink-soft">{k}</span>
      <strong>{v}</strong>
    </div>
  );
}
