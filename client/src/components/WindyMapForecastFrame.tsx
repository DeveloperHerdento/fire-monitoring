import { useState } from 'react';
import type { LatLng } from '../types';
import { WINDY_MAP_FORECAST_KEY, windyEmbedUrl, type WindyOverlay } from '../lib/windyApi';

interface Props {
  center: LatLng;
  onClose: () => void;
}

const OVERLAYS: { id: WindyOverlay; label: string }[] = [
  { id: 'wind', label: 'Wind' },
  { id: 'temp', label: 'Temp' },
  { id: 'pressure', label: 'Pressure' },
];

/**
 * Windy's own Map Forecast map, embedded as an iframe — not merged into our
 * Leaflet map (that path is a dead end, see lib/windyApi.ts). Sized large since
 * this is the primary way to see Windy's Wind/Temp/Pressure rendering; a small
 * corner widget wasn't worth much next to the animated Wind layer already on
 * the main map.
 */
export default function WindyMapForecastFrame({ center, onClose }: Props) {
  const [overlay, setOverlay] = useState<WindyOverlay>('wind');

  if (!WINDY_MAP_FORECAST_KEY) {
    return (
      <div className="absolute bottom-4 left-4 z-[450] bg-surface border border-line rounded-xl shadow-lg p-3 text-xs max-w-[260px]">
        <div className="font-bold mb-1">Windy Map Forecast</div>
        <p className="text-ink-faint">Set <code className="font-mono">VITE_WINDY_MAP_FORECAST_KEY</code> in client/.env to enable this panel.</p>
        <button onClick={onClose} className="mt-2 text-[#ec3013] font-semibold">Dismiss</button>
      </div>
    );
  }

  return (
    <div className="absolute inset-4 sm:inset-8 z-[450] bg-surface border border-line rounded-2xl shadow-2xl overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-line shrink-0">
        <div className="flex gap-1.5">
          {OVERLAYS.map((o) => (
            <button
              key={o.id}
              onClick={() => setOverlay(o.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${overlay === o.id ? 'bg-[#ec3013] text-white' : 'text-ink-soft hover:bg-canvas'}`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <button onClick={onClose} className="text-ink-faint hover:text-ink text-lg px-2 leading-none">✕</button>
      </div>
      <iframe
        key={overlay}
        title="Windy Map Forecast"
        src={windyEmbedUrl(center[0], center[1], 6, overlay)}
        className="flex-1 w-full border-0"
        loading="lazy"
      />
    </div>
  );
}
