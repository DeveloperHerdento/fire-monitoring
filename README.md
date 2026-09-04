# Fire Monitoring System — RATRA MAPS

Real AOI → live NASA FIRMS hotspot data → derived metrics, matching the RATRA MAPS agriculture product's UI patterns (top nav, Layer/History side panel, Leaflet + Esri imagery, white/red RATRA theme).

## Structure

- `server/` — Node/Express proxy. Keeps the FIRMS `MAP_KEY` server-side, calls the FIRMS Area API, normalizes VIIRS/MODIS CSV into JSON, 5-minute in-memory cache.
- `client/` — Vite + React + TypeScript + Tailwind v4. Leaflet + `leaflet-draw` for AOI drawing, `@turf/turf` for area/bbox/point-in-polygon/distance.

## Run it

```bash
# terminal 1
cd app/server
cp .env.example .env   # fill in FIRMS_MAP_KEY (free: firms.modaps.eosdis.nasa.gov/api/area/)
npm install
npm run dev             # http://localhost:8787

# terminal 2
cd app/client
npm install
npm run dev              # http://localhost:5173 (proxies /api -> :8787)
```

## Flow implemented

1. **Field Management → Draw AOI.** Polygon/rectangle tool (leaflet-draw). Save gives it a name; the AOI is stored (localStorage for now) and becomes active.
2. **Fetch.** On save/activate, the client computes the AOI's bounding box (padded ~15km for nearby-impact context) and asks the backend for hotspots (`VIIRS_SNPP_NRT` + `MODIS_NRT` by default, day range 1–10, selectable satellite sources).
3. **Analyze.** Every hotspot is annotated client-side (turf) with `inAoi` and `distanceToBoundaryKm`. Dashboard, Field Management's 5 map modules, and Analytics all derive their numbers from this one annotated set — nothing is mocked once an AOI has been fetched.

### Module status

| Module | Data | Status |
|---|---|---|
| Active Fire Hotspot Detection | NASA FIRMS (VIIRS/MODIS) | **Live** |
| Fire Timeline & Landscape Change | FIRMS, stepped by `acq_date` within the fetched window | **Live** (timeline is detection-date scrubbing, not before/after imagery yet) |
| Fire Nearby Impact | FIRMS + turf distance-to-boundary, 1/3/5km rings | **Live** |
| Burned Area | Sentinel-2 dNBR | Not connected — needs an imagery provider (e.g. Sentinel Hub) key |
| Smoke Detection | Aerosol/wind | Not connected — needs an aerosol + meteorological data source |

The two unconnected modules render their real UI chrome (legend, module description) with a clear empty state, so wiring in a provider later is a data-layer change, not a UI rebuild.

## Notes

- AOI persistence is `localStorage` only right now (no backend DB/auth) — fine for a single-user demo, not for multi-user production.
- FIRMS Area API caps at 10-day windows and has a transaction quota; `/api/firms/status` on the backend surfaces the current quota if you want to display it.
