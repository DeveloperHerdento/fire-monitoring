export const WINDY_MAP_FORECAST_KEY = import.meta.env.VITE_WINDY_MAP_FORECAST_KEY as string | undefined;

export type WindyOverlay = 'wind' | 'temp' | 'pressure';

export function windyEmbedUrl(lat: number, lng: number, zoom: number, overlay: WindyOverlay = 'wind'): string {
  const params = new URLSearchParams({
    lat: lat.toFixed(3),
    lon: lng.toFixed(3),
    detailLat: lat.toFixed(3),
    detailLon: lng.toFixed(3),
    zoom: String(zoom),
    level: 'surface',
    overlay,
    menu: '',
    message: 'true',
    marker: 'true',
    calendar: 'now',
    pressure: '',
    type: 'map',
    location: 'coordinates',
    metricWind: 'km/h',
    metricTemp: '°C',
    radarRange: '-1',
    key: WINDY_MAP_FORECAST_KEY ?? '',
  });
  return `https://embed.windy.com/embed2.html?${params.toString()}`;
}
