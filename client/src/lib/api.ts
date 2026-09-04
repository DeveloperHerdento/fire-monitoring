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
