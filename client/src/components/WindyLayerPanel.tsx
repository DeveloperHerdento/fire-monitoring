import { WINDY_MAP_FORECAST_KEY } from '../lib/windyApi';

interface Props {
  enabled: boolean;
  onToggle: () => void;
}

/** Toggles the floating Windy Map Forecast panel (WindyMapForecastFrame) on/off. */
export default function WindyLayerPanel({ enabled, onToggle }: Props) {
  const available = Boolean(WINDY_MAP_FORECAST_KEY);

  return (
    <div className="mb-4 border-t border-line pt-3.5">
      <div className="text-xs font-semibold text-ink-soft mb-2">Windy.com (beta)</div>
      <label className={`flex items-start gap-2 text-sm ${available ? 'text-ink-soft cursor-pointer' : 'text-ink-faint cursor-not-allowed'}`}>
        <input type="checkbox" checked={enabled} disabled={!available} onChange={onToggle} className="w-4 h-4 mt-0.5 accent-[#ec3013]" />
        <span>
          Map Forecast panel
          <span className="block font-normal text-[11px] text-ink-faint mt-0.5">
            {available ? "Windy's own wind/temp/pressure map, full view" : 'Set VITE_WINDY_MAP_FORECAST_KEY in client/.env'}
          </span>
        </span>
      </label>
    </div>
  );
}
