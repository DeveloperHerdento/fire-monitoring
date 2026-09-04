import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAoi } from '../state/AoiContext';
import TrendChart from '../components/charts/TrendChart';
import BarList from '../components/charts/BarList';
import { formatAcqDate, formatWibDate, formatWibTime, tierBg, confidenceLabel } from '../lib/format';

type SortKey = 'time' | 'confidence' | 'frp' | 'distance';
type StatusFilter = 'all' | 'in' | 'nearby';
type ConfidenceFilter = 'all' | 'high' | 'nominal' | 'low';

const SOURCE_LABELS: Record<string, string> = {
  VIIRS_SNPP_NRT: 'VIIRS (Suomi NPP)',
  VIIRS_NOAA20_NRT: 'VIIRS (NOAA-20)',
  VIIRS_NOAA21_NRT: 'VIIRS (NOAA-21)',
  MODIS_NRT: 'MODIS (Terra/Aqua)',
};

export default function Analytics() {
  const { activeAoi, hotspots, inAoiHotspots, nearbyHotspots } = useAoi();
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState<SortKey>('time');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [minFrp, setMinFrp] = useState<string>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const trend = useMemo(() => {
    const byDate = new Map<string, number>();
    inAoiHotspots.forEach((h) => byDate.set(h.acqDate, (byDate.get(h.acqDate) ?? 0) + 1));
    const dates = [...byDate.keys()].sort();
    return { labels: dates.map(formatAcqDate), values: dates.map((d) => byDate.get(d)!) };
  }, [inAoiHotspots]);

  const confidenceDist = useMemo(() => {
    const c = { high: 0, nominal: 0, low: 0 };
    inAoiHotspots.forEach((h) => c[h.confidence]++);
    return c;
  }, [inAoiHotspots]);

  const bySource = useMemo(() => {
    const m = new Map<string, number>();
    inAoiHotspots.forEach((h) => m.set(h.source, (m.get(h.source) ?? 0) + 1));
    return [...m.entries()].map(([label, value]) => ({ label: label.replace('_NRT', '').replace('_', ' '), value }));
  }, [inAoiHotspots]);

  const frpBuckets = useMemo(() => {
    const buckets = [
      { label: '< 5 MW', min: 0, max: 5 },
      { label: '5 – 20 MW', min: 5, max: 20 },
      { label: '20 – 50 MW', min: 20, max: 50 },
      { label: '> 50 MW', min: 50, max: Infinity },
    ];
    return buckets.map((b) => ({
      label: b.label,
      value: inAoiHotspots.filter((h) => (h.frp ?? 0) >= b.min && (h.frp ?? 0) < b.max).length,
      color: '#ec3013',
    }));
  }, [inAoiHotspots]);

  const sourceOptions = useMemo(() => [...new Set(hotspots.map((h) => h.source))].sort(), [hotspots]);

  const filtersActive = statusFilter !== 'all' || confidenceFilter !== 'all' || sourceFilter !== 'all' || minFrp !== '';

  const resetFilters = () => {
    setStatusFilter('all');
    setConfidenceFilter('all');
    setSourceFilter('all');
    setMinFrp('');
  };

  const filteredRows = useMemo(() => {
    const minFrpNum = minFrp === '' ? null : Number(minFrp);
    return hotspots.filter((h) => {
      if (statusFilter === 'in' && !h.inAoi) return false;
      if (statusFilter === 'nearby' && h.inAoi) return false;
      if (confidenceFilter !== 'all' && h.confidence !== confidenceFilter) return false;
      if (sourceFilter !== 'all' && h.source !== sourceFilter) return false;
      if (minFrpNum !== null && !Number.isNaN(minFrpNum) && (h.frp ?? 0) < minFrpNum) return false;
      return true;
    });
  }, [hotspots, statusFilter, confidenceFilter, sourceFilter, minFrp]);

  const sortedRows = useMemo(() => {
    const rows = [...filteredRows];
    rows.sort((a, b) => {
      if (sortKey === 'time') return (b.acqDate + b.acqTime).localeCompare(a.acqDate + a.acqTime);
      if (sortKey === 'confidence') return { high: 0, nominal: 1, low: 2 }[a.confidence] - { high: 0, nominal: 1, low: 2 }[b.confidence];
      if (sortKey === 'frp') return (b.frp ?? 0) - (a.frp ?? 0);
      return (a.distanceToBoundaryKm ?? 0) - (b.distanceToBoundaryKm ?? 0);
    });
    return rows;
  }, [filteredRows, sortKey]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, confidenceFilter, sourceFilter, minFrp, sortKey, activeAoi?.id]);

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedRows = useMemo(
    () => sortedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [sortedRows, currentPage, pageSize]
  );
  const rangeStart = sortedRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, sortedRows.length);

  if (!activeAoi) {
    return (
      <div className="max-w-md mx-auto text-center py-28 px-6">
        <h1 className="text-xl font-bold mb-2">No Area of Interest yet</h1>
        <p className="text-sm text-ink-soft mb-6">Analytics are computed from live hotspot data inside an AOI. Draw one to get started.</p>
        <button onClick={() => navigate('/field')} className="bg-[#ec3013] hover:bg-[#c22910] text-white font-semibold text-sm rounded-lg px-5 py-2.5">
          Draw your first AOI
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-8 py-5 sm:py-8 pb-8 max-w-[1400px] mx-auto">
      <h1 className="text-xl sm:text-2xl font-extrabold mb-1">Fire Analytics</h1>
      <p className="text-ink-soft mb-6 text-sm sm:text-base">
        Full breakdown for <strong className="text-ink">{activeAoi.name}</strong> — {inAoiHotspots.length} in-AOI, {nearbyHotspots.length} nearby detections.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <Card title="Hotspot Trend" sub="Detections per day inside AOI">
          <TrendChart labels={trend.labels} values={trend.values} height={170} />
        </Card>
        <Card title="Confidence Level Distribution" sub="Proportion of detections by confidence tier">
          <div className="flex h-3 rounded-full overflow-hidden mb-3 bg-line-soft">
            {(['high', 'nominal', 'low'] as const).map((t) => (
              <div key={t} style={{ width: `${inAoiHotspots.length ? (confidenceDist[t] / inAoiHotspots.length) * 100 : 0}%`, background: tierBg(t).fg }} />
            ))}
          </div>
          {(['high', 'nominal', 'low'] as const).map((t) => (
            <div key={t} className="flex justify-between text-sm mb-1.5">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: tierBg(t).fg }} />{confidenceLabel(t)}</span>
              <strong>{confidenceDist[t]}</strong>
            </div>
          ))}
        </Card>
        <Card title="Fire Radiative Power" sub="Detections bucketed by FRP (fire intensity)">
          <BarList items={frpBuckets} />
        </Card>
        <Card title="Detections by Satellite Source" sub="Which sensor is contributing detections">
          <BarList items={bySource} />
        </Card>
      </div>

      <div className="flex items-center justify-between mb-3 mt-2 flex-wrap gap-2">
        <h2 className="font-bold text-lg">
          All Detections ({filteredRows.length}{filtersActive ? ` of ${hotspots.length}` : ''})
        </h2>
        <div className="flex gap-1.5 text-sm">
          {(['time', 'confidence', 'frp', 'distance'] as SortKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setSortKey(k)}
              className={`px-4 py-2 rounded-full font-semibold capitalize transition-colors ${sortKey === k ? 'bg-[#ec3013] text-white shadow-sm' : 'bg-canvas text-ink-soft hover:bg-line-soft'}`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-line rounded-2xl shadow-sm p-3 mb-4 flex flex-wrap items-center gap-4">
        <FilterGroup label="Status">
          {(['all', 'in', 'nearby'] as StatusFilter[]).map((v) => (
            <FilterPill key={v} active={statusFilter === v} onClick={() => setStatusFilter(v)}>
              {v === 'all' ? 'All' : v === 'in' ? 'In AOI' : 'Nearby'}
            </FilterPill>
          ))}
        </FilterGroup>

        <FilterGroup label="Confidence">
          {(['all', 'high', 'nominal', 'low'] as ConfidenceFilter[]).map((v) => (
            <FilterPill key={v} active={confidenceFilter === v} onClick={() => setConfidenceFilter(v)}>
              {v === 'all' ? 'All' : confidenceLabel(v)}
            </FilterPill>
          ))}
        </FilterGroup>

        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">Source</span>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="border border-line rounded-full px-3 py-1.5 text-xs font-semibold text-ink-soft bg-white focus:outline-none focus:ring-2 focus:ring-[#ec3013]/30 focus:border-[#ec3013] transition-shadow"
          >
            <option value="all">All sources</option>
            {sourceOptions.map((s) => (
              <option key={s} value={s}>{SOURCE_LABELS[s] ?? s}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">Min FRP (MW)</span>
          <input
            type="number"
            min={0}
            placeholder="e.g. 10"
            value={minFrp}
            onChange={(e) => setMinFrp(e.target.value)}
            className="w-24 border border-line rounded-full px-3 py-1.5 text-xs font-semibold text-ink bg-white focus:outline-none focus:ring-2 focus:ring-[#ec3013]/30 focus:border-[#ec3013] transition-shadow"
          />
        </div>

        {filtersActive && (
          <button
            onClick={resetFilters}
            className="ml-auto text-xs font-semibold text-[#ec3013] hover:underline shrink-0"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="bg-white border border-line rounded-2xl shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left text-[10.5px] uppercase tracking-wide text-ink-faint bg-canvas">
              <th className="px-3 py-2.5 font-semibold">Status</th>
              <th className="px-3 py-2.5 font-semibold">Confidence</th>
              <th className="px-3 py-2.5 font-semibold">Location</th>
              <th className="px-3 py-2.5 font-semibold">Source</th>
              <th className="px-3 py-2.5 font-semibold">FRP</th>
              <th className="px-3 py-2.5 font-semibold">Distance</th>
              <th className="px-3 py-2.5 font-semibold text-right">Detected</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-8 text-ink-faint text-xs">
                  {filtersActive ? (
                    <>No detections match these filters. <button onClick={resetFilters} className="text-[#ec3013] font-semibold hover:underline">Clear filters</button></>
                  ) : (
                    'No hotspots in the fetched bounding box for this window.'
                  )}
                </td>
              </tr>
            )}
            {pagedRows.map((h) => (
              <tr key={h.id} className="border-t border-line-soft hover:bg-canvas transition-colors">
                <td className="px-3 py-2.5">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${h.inAoi ? 'bg-[#fff2ee] text-[#ae1800]' : 'bg-line-soft text-ink-soft'}`}>
                    {h.inAoi ? 'IN AOI' : 'NEARBY'}
                  </span>
                </td>
                <td className="px-3 py-2.5 font-semibold" style={{ color: tierBg(h.confidence).fg }}>{confidenceLabel(h.confidence)}</td>
                <td className="px-3 py-2.5 font-mono text-xs text-ink-soft">{h.lat.toFixed(4)}, {h.lng.toFixed(4)}</td>
                <td className="px-3 py-2.5 text-ink-soft">{h.satellite} {h.instrument}</td>
                <td className="px-3 py-2.5">{h.frp ?? '—'} MW</td>
                <td className="px-3 py-2.5">{h.distanceToBoundaryKm ?? 0} km</td>
                <td className="px-3 py-2.5 text-right text-ink-faint whitespace-nowrap">{formatWibDate(h.acqDate, h.acqTime)} · {formatWibTime(h.acqDate, h.acqTime)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sortedRows.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
          <div className="flex items-center gap-3 text-sm text-ink-soft">
            <span>
              Showing <strong className="text-ink">{rangeStart}–{rangeEnd}</strong> of <strong className="text-ink">{sortedRows.length}</strong>
            </span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="border border-line rounded-full px-3.5 py-2 text-sm font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-[#ec3013]/30 focus:border-[#ec3013] transition-shadow"
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>{n} / page</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 rounded-full text-sm font-semibold bg-canvas text-ink-soft hover:bg-line-soft disabled:opacity-40 disabled:hover:bg-canvas transition-colors"
            >
              ← Prev
            </button>
            {paginationItems(currentPage, pageCount).map((item, i) =>
              item === '…' ? (
                <span key={`gap-${i}`} className="px-2 text-sm text-ink-faint">…</span>
              ) : (
                <button
                  key={item}
                  onClick={() => setPage(item as number)}
                  className={`w-9 h-9 rounded-full text-sm font-semibold transition-colors ${
                    item === currentPage ? 'bg-[#ec3013] text-white shadow-sm' : 'text-ink-soft hover:bg-line-soft'
                  }`}
                >
                  {item}
                </button>
              )
            )}
            <button
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={currentPage === pageCount}
              className="px-4 py-2 rounded-full text-sm font-semibold bg-canvas text-ink-soft hover:bg-line-soft disabled:opacity-40 disabled:hover:bg-canvas transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Compact page-number list with ellipsis gaps, e.g. [1, '…', 4, 5, 6, '…', 12]. */
function paginationItems(current: number, total: number): (number | '…')[] {
  const items: (number | '…')[] = [];
  const add = (n: number) => items.push(n);
  const pad = 1;
  add(1);
  if (current - pad > 2) items.push('…');
  for (let n = Math.max(2, current - pad); n <= Math.min(total - 1, current + pad); n++) add(n);
  if (current + pad < total - 1) items.push('…');
  if (total > 1) add(total);
  return items;
}

function Card({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-line rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="font-semibold text-sm mb-0.5">{title}</div>
      <div className="text-xs text-ink-faint mb-3">{sub}</div>
      {children}
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">{label}</span>
      <div className="flex gap-1">{children}</div>
    </div>
  );
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors ${
        active ? 'bg-[#ec3013] text-white shadow-sm' : 'bg-canvas text-ink-soft hover:bg-line-soft'
      }`}
    >
      {children}
    </button>
  );
}
