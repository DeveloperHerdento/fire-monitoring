import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Aoi, Hotspot, LatLng, SourceId } from '../types';
import { annotateHotspots, countByDate, polygonAreaHa, polygonBbox, polygonCentroid } from '../lib/geo';
import { acqTimestampMs, wibDateAndMinute } from '../lib/format';
import { fetchFires, fetchWeather, type Weather } from '../lib/api';
import { loadActiveAoiId, loadAois, saveActiveAoiId, saveAois } from '../lib/storage';
import { isKalimantanDemoAoi } from '../data/kalimantanAoi';
import kalimantanSeed from '../data/kalimantanSeed.json';
import type { FiresResponse } from '../types';

// FIRMS Area API caps day_range at 5 for these NRT sources — confirmed empirically
// (6+ returns "Invalid day range. Expects [1..5]").
export const DAY_RANGE_OPTIONS = [1, 2, 3, 5] as const;
export const MAX_DAY_RANGE = 5;
// Client-side trim on top of the day-range fetch, so the map doesn't have to render
// a full day (or more) of points at once. "Latest" is anchored to the most recent
// detection actually present in the fetched data, not wall-clock time, so it keeps
// working for the frozen demo dataset and for older end-dates alike.
export const HOUR_RANGE_OPTIONS = [1, 2, 6, 12, 24] as const;
export const DEFAULT_HOUR_RANGE = 2;
export const DEFAULT_CUSTOM_FROM = '13:00';
export const DEFAULT_CUSTOM_TO = '14:00';
export const SOURCE_OPTIONS: { id: SourceId; label: string }[] = [
  { id: 'VIIRS_SNPP_NRT', label: 'VIIRS (Suomi NPP)' },
  { id: 'VIIRS_NOAA20_NRT', label: 'VIIRS (NOAA-20)' },
  { id: 'VIIRS_NOAA21_NRT', label: 'VIIRS (NOAA-21)' },
  { id: 'MODIS_NRT', label: 'MODIS (Terra/Aqua)' },
];

interface AoiContextValue {
  aois: Aoi[];
  activeAoi: Aoi | null;
  hotspots: Hotspot[]; // all hotspots in the padded bbox, annotated with inAoi + distance
  inAoiHotspots: Hotspot[];
  nearbyHotspots: Hotspot[]; // outside AOI but within fetched bbox
  rawHotspots: Hotspot[]; // everything in the fetched day-range window, unannotated, before any hour trim
  dayCountsInAoi: Record<string, number>; // per-date counts over rawHotspots — cheap, feeds the timeline
  dayCountsAll: Record<string, number>;
  hotspotsForDate: (date: string) => Hotspot[]; // annotated hotspots for one specific date (not the whole window)
  status: 'idle' | 'loading' | 'error';
  error: string | null;
  fetchedAt: string | null;
  dayRange: number;
  hourRange: number;
  hourMode: 'relative' | 'custom';
  customFrom: string; // HH:MM, WIB
  customTo: string; // HH:MM, WIB
  customDate: string | null; // WIB date the custom range is applied to (most recent one present)
  sources: SourceId[];
  endDate: string | null; // YYYY-MM-DD, null = latest available
  createAoi: (name: string, ring: LatLng[]) => Aoi;
  deleteAoi: (id: string) => void;
  renameAoi: (id: string, name: string) => void;
  setActiveAoiId: (id: string | null) => void;
  setDayRange: (n: number) => void;
  setHourRange: (n: number) => void;
  setHourMode: (m: 'relative' | 'custom') => void;
  setCustomFrom: (t: string) => void;
  setCustomTo: (t: string) => void;
  setSources: (s: SourceId[]) => void;
  setEndDate: (d: string | null) => void;
  refetch: () => void;
  centroid: LatLng | null;
  weather: Weather | null;
}

const AoiContext = createContext<AoiContextValue | null>(null);

type DemoSeed = FiresResponse & { demoRange?: { from: string; to: string } };

/** Slices the frozen Kalimantan dataset down to the requested day-range window, same as a live FIRMS query would. */
function filterDemoHotspots(seed: DemoSeed, dayRange: number, endDate: string | null): Hotspot[] {
  const to = endDate || seed.demoRange?.to || seed.hotspots[seed.hotspots.length - 1]?.acqDate;
  if (!to) return seed.hotspots;
  const toDate = new Date(`${to}T00:00:00Z`);
  const fromDate = new Date(toDate);
  fromDate.setUTCDate(fromDate.getUTCDate() - (dayRange - 1));
  const from = fromDate.toISOString().slice(0, 10);
  return seed.hotspots.filter((h) => h.acqDate >= from && h.acqDate <= to);
}

/** Trims to the last N hours, anchored to the most recent detection actually present. */
function windowByHours(hotspots: Hotspot[], hours: number): Hotspot[] {
  if (!hotspots.length) return hotspots;
  let latest = -Infinity;
  for (const h of hotspots) {
    const ts = acqTimestampMs(h.acqDate, h.acqTime);
    if (ts > latest) latest = ts;
  }
  const cutoff = latest - hours * 3600 * 1000;
  return hotspots.filter((h) => acqTimestampMs(h.acqDate, h.acqTime) >= cutoff);
}

function toMinuteOfDay(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Most recent WIB calendar date present in the data — the day a custom clock-time range applies to. */
function latestWibDate(hotspots: Hotspot[]): string | null {
  let latest: string | null = null;
  for (const h of hotspots) {
    const { date } = wibDateAndMinute(h.acqDate, h.acqTime);
    if (!latest || date > latest) latest = date;
  }
  return latest;
}

/** Trims to a specific clock-time range (WIB) on the most recent day present, e.g. 13:00-14:00. */
function windowByCustomRange(hotspots: Hotspot[], from: string, to: string): Hotspot[] {
  if (!hotspots.length) return hotspots;
  const date = latestWibDate(hotspots);
  const fromMin = toMinuteOfDay(from);
  const toMin = toMinuteOfDay(to);
  return hotspots.filter((h) => {
    const wib = wibDateAndMinute(h.acqDate, h.acqTime);
    if (wib.date !== date) return false;
    if (fromMin <= toMin) return wib.minuteOfDay >= fromMin && wib.minuteOfDay < toMin;
    return wib.minuteOfDay >= fromMin || wib.minuteOfDay < toMin; // overnight wrap, e.g. 22:00-03:00
  });
}

export function AoiProvider({ children }: { children: React.ReactNode }) {
  const [aois, setAois] = useState<Aoi[]>(() => loadAois());
  const [activeAoiId, setActiveAoiIdState] = useState<string | null>(() => {
    const saved = loadActiveAoiId();
    if (saved) return saved;
    // First run on a device: default straight into the Kalimantan demo AOI so
    // there's something to show without requiring the user to draw one first.
    return aois.find((a) => isKalimantanDemoAoi(a.name))?.id ?? null;
  });
  const [dayRange, setDayRange] = useState<number>(1);
  const [hourRange, setHourRange] = useState<number>(DEFAULT_HOUR_RANGE);
  const [hourMode, setHourMode] = useState<'relative' | 'custom'>('relative');
  const [customFrom, setCustomFrom] = useState<string>(DEFAULT_CUSTOM_FROM);
  const [customTo, setCustomTo] = useState<string>(DEFAULT_CUSTOM_TO);
  const [sources, setSources] = useState<SourceId[]>(['VIIRS_SNPP_NRT', 'MODIS_NRT']);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [rawHotspots, setRawHotspots] = useState<Hotspot[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  const activeAoi = useMemo(() => aois.find((a) => a.id === activeAoiId) ?? null, [aois, activeAoiId]);

  useEffect(() => saveAois(aois), [aois]);
  useEffect(() => saveActiveAoiId(activeAoiId), [activeAoiId]);

  const refetch = useCallback(() => {
    if (!activeAoi) {
      setRawHotspots([]);
      return;
    }
    if (activeAoi.isDemo || isKalimantanDemoAoi(activeAoi.name)) {
      // Frozen dataset (real FIRMS detections, last ~5 days) so the demo doesn't
      // depend on live FIRMS availability/rate limits. Sliced to the selected
      // day-range window (default: latest day only) to keep the map light.
      // Other AOIs still fetch live.
      const seed = kalimantanSeed as unknown as DemoSeed;
      setStatus('loading');
      setError(null);
      setRawHotspots(filterDemoHotspots(seed, dayRange, endDate));
      setFetchedAt(seed.fetchedAt);
      setStatus('idle');
      return;
    }
    setStatus('loading');
    setError(null);
    const bbox = polygonBbox(activeAoi.ring);
    fetchFires({ bbox, days: dayRange, sources, date: endDate })
      .then((res) => {
        setRawHotspots(res.hotspots);
        setFetchedAt(res.fetchedAt);
        setStatus('idle');
      })
      .catch((err) => {
        setError(err.message || 'Failed to fetch hotspot data');
        setStatus('error');
      });
  }, [activeAoi, dayRange, sources, endDate]);

  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAoi?.id, dayRange, sources.join(','), endDate]);

  const windowedHotspots = useMemo(
    () =>
      hourMode === 'custom'
        ? windowByCustomRange(rawHotspots, customFrom, customTo)
        : windowByHours(rawHotspots, hourRange),
    [rawHotspots, hourMode, hourRange, customFrom, customTo]
  );

  const customDate = useMemo(
    () => (hourMode === 'custom' ? latestWibDate(rawHotspots) : null),
    [hourMode, rawHotspots]
  );

  const hotspots = useMemo(() => {
    if (!activeAoi) return [];
    return annotateHotspots(activeAoi.ring, windowedHotspots);
  }, [activeAoi, windowedHotspots]);

  const inAoiHotspots = useMemo(() => hotspots.filter((h) => h.inAoi), [hotspots]);
  const nearbyHotspots = useMemo(() => hotspots.filter((h) => !h.inAoi), [hotspots]);

  // Per-date counts over the whole fetched day-range window, before the hour/custom
  // trim — feeds the timeline. Boolean-only point-in-polygon (no nearest-boundary
  // distance calc), so it stays cheap even at "5 days" (thousands of points).
  const dayCountsInAoi = useMemo(
    () => (activeAoi ? countByDate(activeAoi.ring, rawHotspots, 'inAoi') : {}),
    [activeAoi, rawHotspots]
  );
  const dayCountsAll = useMemo(() => countByDate([], rawHotspots, 'all'), [rawHotspots]);

  // Full annotation (with distance-to-boundary) computed on demand for just one day's
  // points, not the whole window — same cost as the default recent-window view.
  const hotspotsForDate = useCallback(
    (date: string) => {
      if (!activeAoi) return [];
      return annotateHotspots(activeAoi.ring, rawHotspots.filter((h) => h.acqDate === date));
    },
    [activeAoi, rawHotspots]
  );

  const centroid = useMemo(() => (activeAoi ? polygonCentroid(activeAoi.ring) : null), [activeAoi]);

  const [weather, setWeather] = useState<Weather | null>(null);
  useEffect(() => {
    if (!centroid) {
      setWeather(null);
      return;
    }
    let cancelled = false;
    fetchWeather(centroid[0], centroid[1])
      .then((w) => !cancelled && setWeather(w))
      .catch(() => !cancelled && setWeather(null));
    return () => {
      cancelled = true;
    };
  }, [centroid?.[0], centroid?.[1]]);

  const createAoi = useCallback((name: string, ring: LatLng[]): Aoi => {
    const aoi: Aoi = {
      id: `aoi_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name,
      createdAt: new Date().toISOString(),
      ring,
      areaHa: polygonAreaHa(ring),
    };
    setAois((prev) => [aoi, ...prev]);
    setActiveAoiIdState(aoi.id);
    return aoi;
  }, []);

  const deleteAoi = useCallback(
    (id: string) => {
      setAois((prev) => prev.filter((a) => a.id !== id));
      if (activeAoiId === id) setActiveAoiIdState(null);
    },
    [activeAoiId]
  );

  const renameAoi = useCallback((id: string, name: string) => {
    setAois((prev) => prev.map((a) => (a.id === id ? { ...a, name } : a)));
  }, []);

  const setActiveAoiId = useCallback((id: string | null) => setActiveAoiIdState(id), []);

  const value: AoiContextValue = {
    aois,
    activeAoi,
    hotspots,
    inAoiHotspots,
    nearbyHotspots,
    rawHotspots,
    dayCountsInAoi,
    dayCountsAll,
    hotspotsForDate,
    status,
    error,
    fetchedAt,
    dayRange,
    hourRange,
    hourMode,
    customFrom,
    customTo,
    customDate,
    sources,
    endDate,
    createAoi,
    deleteAoi,
    renameAoi,
    setActiveAoiId,
    setDayRange,
    setHourRange,
    setHourMode,
    setCustomFrom,
    setCustomTo,
    setSources,
    setEndDate,
    refetch,
    centroid,
    weather,
  };

  return <AoiContext.Provider value={value}>{children}</AoiContext.Provider>;
}

export function useAoi() {
  const ctx = useContext(AoiContext);
  if (!ctx) throw new Error('useAoi must be used within AoiProvider');
  return ctx;
}
