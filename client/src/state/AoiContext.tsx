import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Aoi, Hotspot, LatLng, SourceId } from '../types';
import { annotateHotspots, polygonAreaHa, polygonBbox, polygonCentroid } from '../lib/geo';
import { fetchFires, fetchWeather, type Weather } from '../lib/api';
import { loadActiveAoiId, loadAois, saveActiveAoiId, saveAois } from '../lib/storage';

// FIRMS Area API caps day_range at 5 for these NRT sources — confirmed empirically
// (6+ returns "Invalid day range. Expects [1..5]").
export const DAY_RANGE_OPTIONS = [1, 2, 3, 5] as const;
export const MAX_DAY_RANGE = 5;
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
  status: 'idle' | 'loading' | 'error';
  error: string | null;
  fetchedAt: string | null;
  dayRange: number;
  sources: SourceId[];
  endDate: string | null; // YYYY-MM-DD, null = latest available
  createAoi: (name: string, ring: LatLng[]) => Aoi;
  deleteAoi: (id: string) => void;
  renameAoi: (id: string, name: string) => void;
  setActiveAoiId: (id: string | null) => void;
  setDayRange: (n: number) => void;
  setSources: (s: SourceId[]) => void;
  setEndDate: (d: string | null) => void;
  refetch: () => void;
  centroid: LatLng | null;
  weather: Weather | null;
}

const AoiContext = createContext<AoiContextValue | null>(null);

export function AoiProvider({ children }: { children: React.ReactNode }) {
  const [aois, setAois] = useState<Aoi[]>(() => loadAois());
  const [activeAoiId, setActiveAoiIdState] = useState<string | null>(() => loadActiveAoiId());
  const [dayRange, setDayRange] = useState<number>(1);
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

  const hotspots = useMemo(() => {
    if (!activeAoi) return [];
    return annotateHotspots(activeAoi.ring, rawHotspots);
  }, [activeAoi, rawHotspots]);

  const inAoiHotspots = useMemo(() => hotspots.filter((h) => h.inAoi), [hotspots]);
  const nearbyHotspots = useMemo(() => hotspots.filter((h) => !h.inAoi), [hotspots]);

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
    status,
    error,
    fetchedAt,
    dayRange,
    sources,
    endDate,
    createAoi,
    deleteAoi,
    renameAoi,
    setActiveAoiId,
    setDayRange,
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
