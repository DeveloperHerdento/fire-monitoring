const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const MAP_KEY = process.env.FIRMS_MAP_KEY;
const FIRMS_BASE = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv';

if (!MAP_KEY) {
  console.warn('[fire-monitoring] FIRMS_MAP_KEY is not set in server/.env — /api/fires will fail.');
}

// In-memory cache to stay well under FIRMS rate limits while a user pans/redraws.
const cache = new Map(); // key -> { ts, data }
const CACHE_TTL_MS = 5 * 60 * 1000;

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > CACHE_TTL_MS) { cache.delete(key); return null; }
  return hit.data;
}
function cacheSet(key, data) {
  cache.set(key, { ts: Date.now(), data });
}

function parseCsv(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    const row = {};
    headers.forEach((h, i) => { row[h] = cells[i] !== undefined ? cells[i].trim() : ''; });
    return row;
  });
}

// Normalize confidence across VIIRS (l/n/h) and MODIS (0-100 numeric) into a shared tier.
function normalizeConfidence(row) {
  const raw = row.confidence;
  if (raw === 'h' || raw === 'high') return 'high';
  if (raw === 'n' || raw === 'nominal') return 'nominal';
  if (raw === 'l' || raw === 'low') return 'low';
  const n = Number(raw);
  if (!Number.isNaN(n)) {
    if (n >= 80) return 'high';
    if (n >= 30) return 'nominal';
    return 'low';
  }
  return 'nominal';
}

function normalizeRow(row, source) {
  return {
    id: `${source}:${row.latitude}:${row.longitude}:${row.acq_date}:${row.acq_time}`,
    source,
    lat: Number(row.latitude),
    lng: Number(row.longitude),
    acqDate: row.acq_date,
    acqTime: row.acq_time,
    satellite: row.satellite || '',
    instrument: row.instrument || '',
    confidenceRaw: row.confidence,
    confidence: normalizeConfidence(row),
    frp: row.frp ? Number(row.frp) : null,
    daynight: row.daynight || '',
    brightness: row.bright_ti4 ? Number(row.bright_ti4) : (row.brightness ? Number(row.brightness) : null),
  };
}

const VALID_SOURCES = new Set([
  'VIIRS_SNPP_NRT', 'VIIRS_SNPP_SP', 'VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT',
  'MODIS_NRT', 'MODIS_SP', 'LANDSAT_NRT',
]);

app.get('/api/health', (req, res) => res.json({ ok: true, hasKey: Boolean(MAP_KEY) }));

app.get('/api/firms/status', async (req, res) => {
  try {
    if (!MAP_KEY) return res.status(500).json({ error: 'FIRMS_MAP_KEY not configured on server' });
    const r = await fetch(`https://firms.modaps.eosdis.nasa.gov/mapserver/mapkey_status/?MAP_KEY=${MAP_KEY}`);
    const text = await r.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
    res.json(parsed);
  } catch (err) {
    res.status(502).json({ error: 'Failed to reach FIRMS status endpoint', detail: String(err) });
  }
});

app.get('/api/fires', async (req, res) => {
  try {
    if (!MAP_KEY) return res.status(500).json({ error: 'FIRMS_MAP_KEY not configured on server. Add it to server/.env.' });

    const { bbox, days = '1', date, sources } = req.query;
    if (!bbox) return res.status(400).json({ error: 'bbox query param is required: west,south,east,north' });

    // FIRMS Area API rejects day_range above 5 for these NRT sources ("Invalid day range. Expects [1..5]").
    const dayRange = Math.min(Math.max(parseInt(days, 10) || 1, 1), 5);
    const sourceList = (sources ? String(sources).split(',') : ['VIIRS_SNPP_NRT', 'MODIS_NRT'])
      .map((s) => s.trim())
      .filter((s) => VALID_SOURCES.has(s));

    if (sourceList.length === 0) {
      return res.status(400).json({ error: 'No valid sources provided', validSources: [...VALID_SOURCES] });
    }

    const cacheKey = `${bbox}|${dayRange}|${date || 'latest'}|${sourceList.join(',')}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    const results = [];
    const errors = [];

    await Promise.all(sourceList.map(async (source) => {
      const path = date
        ? `${FIRMS_BASE}/${MAP_KEY}/${source}/${bbox}/${dayRange}/${date}`
        : `${FIRMS_BASE}/${MAP_KEY}/${source}/${bbox}/${dayRange}`;
      try {
        const r = await fetch(path);
        const text = await r.text();
        if (!r.ok || /invalid/i.test(text.slice(0, 200)) || /error/i.test(text.slice(0, 60))) {
          errors.push({ source, status: r.status, snippet: text.slice(0, 200) });
          return;
        }
        const rows = parseCsv(text).map((row) => normalizeRow(row, source));
        results.push(...rows);
      } catch (err) {
        errors.push({ source, error: String(err) });
      }
    }));

    const payload = {
      bbox,
      dayRange,
      sources: sourceList,
      fetchedAt: new Date().toISOString(),
      count: results.length,
      hotspots: results,
      errors: errors.length ? errors : undefined,
    };
    cacheSet(cacheKey, payload);
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: 'Unexpected server error', detail: String(err) });
  }
});

// Live wind/weather for the smoke-drift estimate and the dashboard's weather card.
// Open-Meteo is free, keyless, and CORS-friendly — but we still proxy it so the
// client only ever talks to our own /api surface, and so we can cache it.
const weatherCache = new Map();
const WEATHER_TTL_MS = 10 * 60 * 1000;

app.get('/api/weather', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng query params are required' });
    const key = `${Number(lat).toFixed(2)},${Number(lng).toFixed(2)}`;
    const cached = weatherCache.get(key);
    if (cached && Date.now() - cached.ts < WEATHER_TTL_MS) return res.json({ ...cached.data, cached: true });

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m&timezone=auto`;
    const r = await fetch(url);
    if (!r.ok) return res.status(502).json({ error: 'Failed to reach Open-Meteo' });
    const json = await r.json();
    const data = {
      tempC: json.current?.temperature_2m ?? null,
      humidityPct: json.current?.relative_humidity_2m ?? null,
      windSpeedKmh: json.current?.wind_speed_10m ?? null,
      windDirectionDeg: json.current?.wind_direction_10m ?? null,
      observedAt: json.current?.time ?? null,
    };
    weatherCache.set(key, { ts: Date.now(), data });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Unexpected server error', detail: String(err) });
  }
});

// Batched wind lookup for many points in one call — used to build a per-hotspot
// wind grid for the smoke module, instead of one wind value for the whole map
// (which was visibly wrong once the AOI spans more than a small area).
app.get('/api/weather-grid', async (req, res) => {
  try {
    const { points } = req.query; // "lat1:lng1,lat2:lng2,..."
    if (!points) return res.status(400).json({ error: 'points query param is required (lat:lng,lat:lng,...)' });
    const pairs = String(points).split(',').map((p) => p.split(':').map(Number));
    if (pairs.length === 0 || pairs.some(([lat, lng]) => Number.isNaN(lat) || Number.isNaN(lng))) {
      return res.status(400).json({ error: 'Malformed points param' });
    }
    if (pairs.length > 60) return res.status(400).json({ error: 'Too many points (max 60 per request)' });

    const cacheKey = `grid:${pairs.map(([lat, lng]) => `${lat.toFixed(2)},${lng.toFixed(2)}`).join('|')}`;
    const cached = weatherCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < WEATHER_TTL_MS) return res.json({ points: cached.data, cached: true });

    const lats = pairs.map(([lat]) => lat).join(',');
    const lngs = pairs.map(([, lng]) => lng).join(',');
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&current=wind_speed_10m,wind_direction_10m&timezone=auto`;
    const r = await fetch(url);
    if (!r.ok) return res.status(502).json({ error: 'Failed to reach Open-Meteo' });
    const json = await r.json();
    // Open-Meteo returns an array when multiple coordinates are requested, or a
    // single object for one point — normalize to an array either way.
    const rows = Array.isArray(json) ? json : [json];
    const result = pairs.map(([lat, lng], i) => {
      const row = rows[i] || rows[0];
      return {
        lat,
        lng,
        windSpeedKmh: row.current?.wind_speed_10m ?? null,
        windDirectionDeg: row.current?.wind_direction_10m ?? null,
      };
    });
    weatherCache.set(cacheKey, { ts: Date.now(), data: result });
    res.json({ points: result });
  } catch (err) {
    res.status(500).json({ error: 'Unexpected server error', detail: String(err) });
  }
});

// Gridded wind field for the animated wind-velocity map layer (leaflet-velocity),
// in the wind-js/GRIB2-JSON shape it expects. Open-Meteo has no raster/grid
// endpoint of its own, so it's sampled on our own lat/lon grid — always fit into
// a SINGLE multi-location call (its free tier's per-minute rate limit gets hit
// almost immediately if we chunk into many calls).
//
// Windy.com's Map Forecast API was tried as a way to get Temperature/Pressure
// map layers too, both as a base-map merge and as a floating panel. The merge
// doesn't work — its loader hard-requires Leaflet 1.4.x and throws if any other
// version (this app runs 1.9.4, needed by leaflet.markercluster/leaflet-velocity)
// is already on the page. The floating panel (see client/src/components/
// WindyMapForecastFrame.tsx) does work and is what's used for those two.
const GRID_TTL_MS = 15 * 60 * 1000;
const gridCache = new Map();
const GRID_MAX_POINTS = 54; // keeps every request to one Open-Meteo call

/** Auto-sizes a lat/lon grid to the bbox's aspect ratio, capped at GRID_MAX_POINTS total samples. */
function buildGrid(west, south, east, north) {
  const lonSpan = Math.max(0.1, east - west);
  const latSpan = Math.max(0.1, north - south);
  const aspect = lonSpan / latSpan;
  let ny = Math.max(2, Math.round(Math.sqrt(GRID_MAX_POINTS / aspect)));
  let nx = Math.max(2, Math.round(GRID_MAX_POINTS / ny));
  while (nx * ny > GRID_MAX_POINTS && (nx > 2 || ny > 2)) {
    if (nx >= ny && nx > 2) nx--; else if (ny > 2) ny--; else nx--;
  }
  const dx = lonSpan / (nx - 1);
  const dy = latSpan / (ny - 1);
  // Row-major, north-to-south then west-to-east.
  const points = [];
  for (let j = 0; j < ny; j++) {
    const lat = north - j * dy;
    for (let i = 0; i < nx; i++) {
      points.push([lat, west + i * dx]);
    }
  }
  return { points, nx, ny, dx, dy };
}

function parseBbox(bbox) {
  const [west, south, east, north] = String(bbox).split(',').map(Number);
  if ([west, south, east, north].some(Number.isNaN)) return null;
  return { west, south, east, north };
}

async function fetchOpenMeteoGrid(points, currentParams) {
  const lats = points.map(([lat]) => lat.toFixed(2)).join(',');
  const lngs = points.map(([, lng]) => lng.toFixed(2)).join(',');
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&current=${currentParams}&timezone=auto`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('Failed to reach Open-Meteo');
  const json = await r.json();
  return Array.isArray(json) ? json : [json];
}

app.get('/api/wind-grid', async (req, res) => {
  try {
    const bbox = parseBbox(req.query.bbox);
    if (!bbox) return res.status(400).json({ error: 'bbox query param is required (west,south,east,north)' });
    const { west, south, east, north } = bbox;

    const cacheKey = `wind:${west.toFixed(1)},${south.toFixed(1)},${east.toFixed(1)},${north.toFixed(1)}`;
    const cached = gridCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < GRID_TTL_MS) return res.json(cached.data);

    const { points, nx, ny, dx, dy } = buildGrid(west, south, east, north);
    const rows = await fetchOpenMeteoGrid(points, 'wind_speed_10m,wind_direction_10m');

    const uData = new Array(points.length);
    const vData = new Array(points.length);
    points.forEach((_, i) => {
      const speedKmh = rows[i]?.current?.wind_speed_10m ?? 0;
      const dirDeg = rows[i]?.current?.wind_direction_10m ?? 0;
      const speedMs = speedKmh / 3.6;
      const dirRad = (dirDeg * Math.PI) / 180;
      // Meteorological direction is "from" — negate to get the vector the wind blows toward.
      uData[i] = -speedMs * Math.sin(dirRad);
      vData[i] = -speedMs * Math.cos(dirRad);
    });

    const header = {
      parameterUnit: 'm.s-1',
      parameterNumberName: 'Wind',
      lo1: west, la1: north, lo2: west + (nx - 1) * dx, la2: north - (ny - 1) * dy,
      dx, dy, nx, ny,
      refTime: new Date().toISOString(),
    };
    const data = [
      { header: { ...header, parameterCategory: 2, parameterNumber: 2 }, data: uData },
      { header: { ...header, parameterCategory: 2, parameterNumber: 3 }, data: vData },
    ];
    gridCache.set(cacheKey, { ts: Date.now(), data });
    res.json(data);
  } catch (err) {
    res.status(err.message === 'Failed to reach Open-Meteo' ? 502 : 500).json({ error: err.message || 'Unexpected server error' });
  }
});

// Vercel imports this file as a serverless function (module.exports = app) and
// calls it directly per-request — it must not also bind a local port there.
if (require.main === module) {
  const PORT = process.env.PORT || 8787;
  app.listen(PORT, () => console.log(`[fire-monitoring] API proxy listening on :${PORT}`));
}

module.exports = app;
