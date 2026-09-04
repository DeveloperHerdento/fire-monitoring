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

// Vercel imports this file as a serverless function (module.exports = app) and
// calls it directly per-request — it must not also bind a local port there.
if (require.main === module) {
  const PORT = process.env.PORT || 8787;
  app.listen(PORT, () => console.log(`[fire-monitoring] API proxy listening on :${PORT}`));
}

module.exports = app;
