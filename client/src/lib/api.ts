import type { FiresResponse, SourceId } from '../types';

export async function fetchFires(params: {
  bbox: [number, number, number, number]; // west, south, east, north
  days: number;
  sources?: SourceId[];
  date?: string | null; // YYYY-MM-DD, end of the window — omit for "latest"
}): Promise<FiresResponse> {
  const { bbox, days, sources, date } = params;
  const qs = new URLSearchParams({
    bbox: bbox.join(','),
    days: String(days),
  });
  if (sources?.length) qs.set('sources', sources.join(','));
  if (date) qs.set('date', date);
  const res = await fetch(`/api/fires?${qs.toString()}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed to fetch hotspots (${res.status})`);
  }
  return res.json();
}

export async function fetchFirmsStatus(): Promise<any> {
  const res = await fetch('/api/firms/status');
  if (!res.ok) throw new Error('Failed to fetch FIRMS quota status');
  return res.json();
}

export interface Weather {
  tempC: number | null;
  humidityPct: number | null;
  windSpeedKmh: number | null;
  windDirectionDeg: number | null;
  observedAt: string | null;
}

export async function fetchWeather(lat: number, lng: number): Promise<Weather> {
  const res = await fetch(`/api/weather?lat=${lat}&lng=${lng}`);
  if (!res.ok) throw new Error('Failed to fetch wind/weather data');
  return res.json();
}

export interface WindGridPoint {
  lat: number;
  lng: number;
  windSpeedKmh: number | null;
  windDirectionDeg: number | null;
}

/** Wind for many points in one call — used to build a per-location wind grid instead of one value for the whole map. */
export async function fetchWeatherGrid(points: [number, number][]): Promise<WindGridPoint[]> {
  if (points.length === 0) return [];
  const qs = points.map(([lat, lng]) => `${lat.toFixed(2)}:${lng.toFixed(2)}`).join(',');
  const res = await fetch(`/api/weather-grid?points=${encodeURIComponent(qs)}`);
  if (!res.ok) throw new Error('Failed to fetch wind grid');
  const data = await res.json();
  return data.points;
}

export interface WindGridRecord {
  header: {
    lo1: number; la1: number; lo2: number; la2: number;
    dx: number; dy: number; nx: number; ny: number;
    parameterNumber: number;
    [key: string]: unknown;
  };
  data: number[];
}

/** U/V wind-component records in wind-js/GRIB2-JSON shape, for the animated leaflet-velocity layer. */
export async function fetchWindGrid(bbox: [number, number, number, number]): Promise<WindGridRecord[]> {
  const qs = new URLSearchParams({ bbox: bbox.join(',') });
  const res = await fetch(`/api/wind-grid?${qs.toString()}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed to fetch wind grid (${res.status})`);
  }
  return res.json();
}
