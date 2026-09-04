import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DAY_RANGE_OPTIONS, SOURCE_OPTIONS, useAoi } from '../state/AoiContext';
import { MODULES } from '../lib/modules';
import type { LatLng, ModuleId, SourceId } from '../types';
import DrawAoiMap from '../components/DrawAoiMap';
import AoiFormModal from '../components/AoiFormModal';
import FireMapCanvas from '../components/FireMapCanvas';
import Legend from '../components/Legend';
import BottomTimeline from '../components/BottomTimeline';
import { formatHa } from '../lib/geo';
import { compassLabel } from '../lib/geo';

const DAY_LABEL: Record<number, string> = { 1: '24 hrs', 2: '48 hrs', 3: '3 days', 5: '5 days' };

export default function FieldManagement() {
  const {
    aois, activeAoi, hotspots, inAoiHotspots, nearbyHotspots,
    status, error, fetchedAt, dayRange, sources, weather, endDate,
    createAoi, deleteAoi, renameAoi, setActiveAoiId, setDayRange, setSources, setEndDate, refetch,
  } = useAoi();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'view' | 'draw'>(aois.length === 0 ? 'draw' : 'view');
  const [draftRing, setDraftRing] = useState<LatLng[] | null>(null);
  const [draftArea, setDraftArea] = useState(0);
  const [showSaveModal, setShowSaveModal] = useState(false);

  const [sideTab, setSideTab] = useState<'layer' | 'history'>('layer');
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [module, setModule] = useState<ModuleId>('hotspot');
  const [showBoundary, setShowBoundary] = useState(true);
  const [opacity, setOpacity] = useState(85);
  const [selectedDate, setSelectedDate] = useState<string | 'all'>('all');
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const activeModule = MODULES.find((m) => m.id === module)!;
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const minDate = useMemo(() => new Date(Date.now() - 120 * 86400000).toISOString().slice(0, 10), []);
  const includesNearby = module === 'impact';
  const scopedHotspots = includesNearby ? hotspots : inAoiHotspots;

  // Continuous calendar range for the selected window (length === dayRange, capped at 5 —
  // the FIRMS Area API's real day_range limit for these sources) so the timeline always
  // follows the actual dates instead of only the days that happened to have detections.
  const timelineDates = useMemo(() => {
    const end = endDate ?? today;
    const endMs = new Date(`${end}T00:00:00Z`).getTime();
    const arr: string[] = [];
    for (let i = dayRange - 1; i >= 0; i--) {
      arr.push(new Date(endMs - i * 86400000).toISOString().slice(0, 10));
    }
    return arr;
  }, [endDate, today, dayRange]);

  const dateCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    scopedHotspots.forEach((h) => { counts[h.acqDate] = (counts[h.acqDate] ?? 0) + 1; });
    return counts;
  }, [scopedHotspots]);

  const mapHotspots = useMemo(() => {
    const base = selectedDate === 'all' ? scopedHotspots : scopedHotspots.filter((h) => h.acqDate === selectedDate);
    return base;
  }, [scopedHotspots, selectedDate]);

  const legendItems = useMemo(() => {
    if (module === 'impact') {
      return [
        { color: '#ae1800', label: 'HIGH — 1 KM RADIUS' },
        { color: '#ec3013', label: 'MEDIUM — 1 KM RADIUS' },
        { color: '#ffc4b8', label: 'LOW — 1 KM RADIUS' },
        { color: '#16171b', label: 'AOI BOUNDARY' },
      ];
    }
    if (module === 'burned') {
      return [
        { color: '#ae1800', label: 'HIGH-CONFIDENCE FOOTPRINT' },
        { color: '#ec3013', label: 'MEDIUM-CONFIDENCE FOOTPRINT' },
        { color: '#ffc4b8', label: 'LOW-CONFIDENCE FOOTPRINT' },
      ];
    }
    if (module === 'smoke') {
      return [
        { color: '#8a8d94', label: 'ESTIMATED PLUME (WIND-DRIVEN)' },
        { color: '#ae1800', label: 'SOURCE HOTSPOT' },
      ];
    }
    return [
      { color: '#ae1800', label: 'HIGH CONFIDENCE' },
      { color: '#ec3013', label: 'MEDIUM' },
      { color: '#ffc4b8', label: 'LOW' },
    ];
  }, [module]);

  function handleSaveAoi(name: string) {
    if (!draftRing) return;
    createAoi(name, draftRing);
    setShowSaveModal(false);
    setDraftRing(null);
    setDraftArea(0);
    setMode('view');
    setSideTab('layer');
  }

  function toggleSource(id: SourceId) {
    setSources(sources.includes(id) ? sources.filter((s) => s !== id) : [...sources, id]);
  }

  if (mode === 'draw') {
    return (
      <div className="relative h-full min-h-[420px]">
        <DrawAoiMap
          hasDraft={!!draftRing}
          onDrawChange={(ring, area) => { setDraftRing(ring); setDraftArea(area); }}
          onSave={() => setShowSaveModal(true)}
          onCancel={() => { setDraftRing(null); setDraftArea(0); }}
        />
        {aois.length > 0 && (
          <button
            onClick={() => setMode('view')}
            className="absolute top-20 right-4 sm:right-6 z-[500] bg-white border border-line rounded-xl px-3 py-1.5 text-xs font-semibold text-ink-soft hover:text-ink shadow"
          >
            Cancel — back to map
          </button>
        )}
        {showSaveModal && draftRing && (
          <AoiFormModal ring={draftRing} areaHa={draftArea} onSave={handleSaveAoi} onCancel={() => setShowSaveModal(false)} />
        )}
      </div>
    );
  }

  const layerPanelContent = (
    <div className="p-4">
      <label className="flex items-center gap-2 font-bold text-sm mb-4">
        <input type="checkbox" checked readOnly className="w-4 h-4 accent-[#ec3013]" />
        Layer Monitoring Kebakaran
      </label>

      <div className="mb-3.5">
        <label className="block text-xs font-semibold text-ink-soft mb-1.5">Module</label>
        <select
          value={module}
          onChange={(e) => { setModule(e.target.value as ModuleId); setSelectedDate('all'); }}
          className="w-full border border-line rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#ec3013]/30 focus:border-[#ec3013] transition-shadow"
        >
          {MODULES.map((m) => (
            <option key={m.id} value={m.id}>{m.full}</option>
          ))}
        </select>
      </div>
      <p className="text-[11.5px] text-ink-faint leading-relaxed mb-4">{activeModule.sub}</p>

      {module === 'smoke' && weather && (
        <div className="bg-[#fff2ee] rounded-xl px-3 py-2.5 mb-4 text-xs">
          <div className="font-bold text-[#7c1405] mb-1">Live wind at AOI</div>
          <div className="flex justify-between text-ink-soft"><span>Wind</span><strong className="text-ink">{compassLabel(weather.windDirectionDeg ?? 0)} · {weather.windSpeedKmh} km/h</strong></div>
          <div className="flex justify-between text-ink-soft"><span>Temp / Humidity</span><strong className="text-ink">{weather.tempC}°C · {weather.humidityPct}%</strong></div>
        </div>
      )}

      <div className="mb-4">
        <label className="block text-xs font-semibold text-ink-soft mb-2">Time window</label>
        <div className="flex flex-wrap gap-1.5">
          {DAY_RANGE_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => { setDayRange(d); setSelectedDate('all'); }}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                dayRange === d ? 'bg-[#ec3013] border-[#ec3013] text-white' : 'border-line text-ink-soft hover:border-ink-faint hover:bg-canvas'
              }`}
            >
              {DAY_LABEL[d]}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-xs font-semibold text-ink-soft mb-2">End date <span className="font-normal text-ink-faint">(window ends here)</span></label>
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={endDate ?? today}
            max={today}
            min={minDate}
            onChange={(e) => { setEndDate(e.target.value === today ? null : e.target.value); setSelectedDate('all'); }}
            className="flex-1 border border-line rounded-xl px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#ec3013]/30 focus:border-[#ec3013] transition-shadow"
          />
          {endDate && (
            <button
              onClick={() => { setEndDate(null); setSelectedDate('all'); }}
              className="text-[11px] font-semibold text-[#ec3013] px-2 py-1.5 rounded-xl hover:bg-canvas transition-colors shrink-0"
            >
              Today
            </button>
          )}
        </div>
        <p className="text-[10.5px] text-ink-faint mt-1.5 leading-relaxed">Fetches the {DAY_LABEL[dayRange].toLowerCase()} window ending on this date. NRT archive typically covers the last few months — very old dates may return no data.</p>
      </div>

      <div className="mb-4">
        <label className="block text-xs font-semibold text-ink-soft mb-2">Satellite source</label>
        <div className="flex flex-col gap-1.5">
          {SOURCE_OPTIONS.map((s) => (
            <label key={s.id} className="flex items-center gap-2 text-xs text-ink-soft">
              <input type="checkbox" checked={sources.includes(s.id)} onChange={() => toggleSource(s.id)} className="w-3.5 h-3.5 accent-[#ec3013]" />
              {s.label}
            </label>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-xs font-semibold text-ink-soft mb-1.5">Opacity: {opacity}%</label>
        <input type="range" min={0} max={100} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} className="w-full accent-[#ec3013]" />
      </div>

      <label className="flex items-center gap-2 text-sm text-ink-soft cursor-pointer">
        <input type="checkbox" checked={showBoundary} onChange={() => setShowBoundary((v) => !v)} className="w-4 h-4 accent-[#ec3013]" />
        AOI Boundary
      </label>
    </div>
  );

  const historyPanelContent = (
    <div className="p-4">
      <button
        onClick={() => setMode('draw')}
        className="w-full bg-[#ec3013] hover:bg-[#c22910] active:scale-[0.98] text-white font-semibold text-sm rounded-xl py-2.5 mb-5 shadow-sm transition-all"
      >
        + Draw New AOI
      </button>
      <div className="font-bold text-xs mb-2.5">AOI List ({aois.length})</div>
      <div className="flex flex-col gap-2">
        {aois.map((a) => (
          <div key={a.id} className="relative">
            <button
              onClick={() => setActiveAoiId(a.id)}
              className={`w-full text-left rounded-xl px-3.5 py-2.5 border transition-colors ${
                activeAoi?.id === a.id ? 'bg-[#fff2ee] border-[#ffc4b8] shadow-sm' : 'border-line hover:border-ink-faint hover:bg-canvas'
              }`}
            >
              {renamingId === a.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && renameValue.trim()) { renameAoi(a.id, renameValue.trim()); setRenamingId(null); }
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  onBlur={() => setRenamingId(null)}
                  className="w-full text-sm font-bold border border-line rounded px-1.5 py-0.5"
                />
              ) : (
                <div className="font-bold text-sm pr-6">{a.name}</div>
              )}
              <div className="text-[11px] text-ink-faint mt-0.5">
                {activeAoi?.id === a.id ? 'active' : 'saved'} · {formatHa(a.areaHa)} · {a.ring.length} pts
              </div>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setOpenMenuFor(openMenuFor === a.id ? null : a.id); }}
              className="absolute top-2.5 right-2.5 w-5 h-5 flex items-center justify-center text-ink-faint hover:text-ink"
            >
              ⋯
            </button>
            {openMenuFor === a.id && (
              <div className="absolute right-0 top-9 z-30 bg-white border border-line rounded-xl shadow-lg w-36 py-1">
                <button
                  onClick={() => { setRenamingId(a.id); setRenameValue(a.name); setOpenMenuFor(null); }}
                  className="w-full text-left px-3 py-1.5 text-xs text-ink-soft hover:bg-canvas"
                >
                  Edit name
                </button>
                <button
                  onClick={() => { deleteAoi(a.id); setOpenMenuFor(null); }}
                  className="w-full text-left px-3 py-1.5 text-xs text-[#ae1800] hover:bg-canvas"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
        {aois.length === 0 && <div className="text-xs text-ink-faint">No AOIs yet.</div>}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col sm:flex-row h-full min-h-[480px]">
      <aside className="hidden sm:flex sm:flex-col w-72 shrink-0 border-r border-line overflow-y-auto bg-white">
        <div className="flex border-b border-line">
          <button
            onClick={() => setSideTab('layer')}
            className={`flex-1 py-3.5 font-[Manrope] font-bold text-sm transition-colors ${sideTab === 'layer' ? 'text-ink border-b-2 border-[#ec3013]' : 'text-ink-faint hover:text-ink-soft'}`}
          >
            Layer
          </button>
          <button
            onClick={() => setSideTab('history')}
            className={`flex-1 py-3.5 font-[Manrope] font-bold text-sm transition-colors ${sideTab === 'history' ? 'text-ink border-b-2 border-[#ec3013]' : 'text-ink-faint hover:text-ink-soft'}`}
          >
            History
          </button>
        </div>
        {sideTab === 'layer' ? layerPanelContent : historyPanelContent}
      </aside>

      <div className="flex-1 relative overflow-hidden">
        {!activeAoi ? (
          <div className="absolute inset-0 flex items-center justify-center bg-canvas px-6">
            <div className="text-center max-w-xs">
              <div className="font-bold text-ink mb-1">No AOI selected</div>
              <p className="text-sm text-ink-soft mb-4">Draw an Area of Interest to start fetching live fire hotspot data.</p>
              <button onClick={() => setMode('draw')} className="bg-[#ec3013] hover:bg-[#c22910] text-white font-semibold text-sm rounded-xl px-4 py-2">
                Draw New AOI
              </button>
            </div>
          </div>
        ) : (
          <>
            <FireMapCanvas
              ring={activeAoi.ring}
              hotspots={mapHotspots}
              module={module}
              showBoundary={showBoundary}
              opacity={opacity}
              weather={weather}
            />
            <div className="hidden sm:block absolute top-4 right-4 z-[400]">
              <Legend title={module === 'impact' ? 'Impact Radius (per point)' : module === 'burned' ? 'Estimated Footprint' : module === 'smoke' ? 'Smoke Estimate' : 'Fire Confidence'} items={legendItems} />
            </div>
            <div className="absolute top-4 left-4 right-4 sm:right-auto z-[400] flex flex-col gap-2">
              {status === 'loading' && (
                <div className="bg-white rounded-xl shadow border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft w-fit">Fetching live hotspots…</div>
              )}
              {status === 'error' && (
                <div className="bg-white rounded-xl shadow border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 max-w-xs">
                  {error} <button onClick={refetch} className="underline ml-1">retry</button>
                </div>
              )}
              {status === 'idle' && fetchedAt && (
                <div className="bg-white rounded-xl shadow border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft w-fit">
                  {inAoiHotspots.length} in AOI · {nearbyHotspots.length} nearby · synced {new Date(fetchedAt).toLocaleTimeString()}
                </div>
              )}
              {(module === 'burned' || module === 'smoke') && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl shadow px-3 py-1.5 text-[11px] font-semibold text-amber-800 w-fit max-w-[280px]">
                  Estimate derived from live hotspot{module === 'smoke' ? ' + wind' : ''} data — not a validated {module === 'burned' ? 'burn-scar' : 'aerosol-imagery'} product.
                </div>
              )}
            </div>

            <BottomTimeline dates={timelineDates} counts={dateCounts} selected={selectedDate} onSelect={setSelectedDate} />

            <button
              onClick={() => navigate('/analytics')}
              className="hidden sm:block absolute bottom-20 right-4 z-[400] bg-white border border-line rounded-xl px-3.5 py-2 text-xs font-semibold text-ink-soft hover:text-ink shadow"
            >
              View full analytics →
            </button>

            {/* Mobile: floating layers button + slide-up sheet */}
            <button
              onClick={() => setMobilePanelOpen(true)}
              className="sm:hidden absolute bottom-20 right-4 z-[420] w-12 h-12 rounded-full bg-[#ec3013] text-white shadow-lg flex items-center justify-center"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12,3 21,8 12,13 3,8"></polygon><polyline points="3,13 12,18 21,13"></polyline></svg>
            </button>
            {mobilePanelOpen && (
              <div className="sm:hidden fixed inset-0 z-[600] flex items-end" onClick={() => setMobilePanelOpen(false)}>
                <div className="absolute inset-0 bg-black/40" />
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="relative w-full max-h-[80vh] overflow-y-auto bg-white rounded-t-2xl shadow-2xl"
                >
                  <div className="sticky top-0 bg-white flex items-center justify-between px-4 py-3 border-b border-line">
                    <div className="flex gap-4">
                      <button onClick={() => setSideTab('layer')} className={`font-[Manrope] font-bold text-sm ${sideTab === 'layer' ? 'text-ink' : 'text-ink-faint'}`}>Layer</button>
                      <button onClick={() => setSideTab('history')} className={`font-[Manrope] font-bold text-sm ${sideTab === 'history' ? 'text-ink' : 'text-ink-faint'}`}>History</button>
                    </div>
                    <button onClick={() => setMobilePanelOpen(false)} className="text-ink-faint">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                    </button>
                  </div>
                  {sideTab === 'layer' ? layerPanelContent : historyPanelContent}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
