import * as turf from '@turf/turf';
import type { LatLng, Hotspot } from '../types';

function ringToGeoJsonPolygon(ring: LatLng[]) {
  const coords = ring.map(([lat, lng]) => [lng, lat]);
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) coords.push(first);
  return turf.polygon([coords]);
}

export function polygonAreaHa(ring: LatLng[]): number {
  if (ring.length < 3) return 0;
  const poly = ringToGeoJsonPolygon(ring);
  return turf.area(poly) / 10000;
}

/** Returns [west, south, east, north] with a small padding so edge hotspots aren't clipped. */
export function polygonBbox(ring: LatLng[], padDeg = 0.15): [number, number, number, number] {
  const poly = ringToGeoJsonPolygon(ring);
  const [west, south, east, north] = turf.bbox(poly);
  return [west - padDeg, south - padDeg, east + padDeg, north + padDeg];
}

export function polygonCentroid(ring: LatLng[]): LatLng {
  const poly = ringToGeoJsonPolygon(ring);
  const [lng, lat] = turf.centroid(poly).geometry.coordinates;
  return [lat, lng];
}

/** Annotates each hotspot with whether it falls inside the AOI and its distance (km) to the AOI boundary. */
export function annotateHotspots(ring: LatLng[], hotspots: Hotspot[]): Hotspot[] {
  if (ring.length < 3) return hotspots;
  const poly = ringToGeoJsonPolygon(ring);
  const boundaryLine = turf.polygonToLine(poly) as any;
  return hotspots.map((h) => {
    const pt = turf.point([h.lng, h.lat]);
    const inAoi = turf.booleanPointInPolygon(pt, poly);
    const distanceToBoundaryKm = turf.pointToLineDistance(pt, boundaryLine, { units: 'kilometers' });
    return { ...h, inAoi, distanceToBoundaryKm: Number(distanceToBoundaryKm.toFixed(2)) };
  });
}

export function formatHa(ha: number): string {
  if (ha >= 100) return `${ha.toFixed(0)} ha`;
  return `${ha.toFixed(2)} ha`;
}

export interface FootprintTier {
  tier: 'high' | 'nominal' | 'low';
  polygon: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> | null;
  areaHa: number;
  pointCount: number;
}

const FOOTPRINT_RADIUS_KM: Record<string, number> = { high: 0.6, nominal: 0.4, low: 0.25 };

/**
 * Approximates a fire footprint by buffering each detection to roughly its sensor
 * pixel size and merging overlapping buffers per confidence tier. This is a proxy
 * for burn severity (recurring high-confidence heat -> more likely severely burned) —
 * not a satellite-verified burn-scar (dNBR) product.
 */
export function fireFootprintByTier(hotspots: Hotspot[]): FootprintTier[] {
  const tiers: Array<'low' | 'nominal' | 'high'> = ['low', 'nominal', 'high'];
  return tiers.map((tier) => {
    const pts = hotspots.filter((h) => h.confidence === tier);
    if (pts.length === 0) return { tier, polygon: null, areaHa: 0, pointCount: 0 };
    const buffers = pts.map((h) => turf.buffer(turf.point([h.lng, h.lat]), FOOTPRINT_RADIUS_KM[tier], { units: 'kilometers' })!);
    const merged = buffers.length > 1 ? turf.union(turf.featureCollection(buffers)) : buffers[0];
    const areaHa = merged ? turf.area(merged) / 10000 : 0;
    return { tier, polygon: merged ?? null, areaHa, pointCount: pts.length };
  });
}

export interface PlumeCone {
  hotspotId: string;
  polygon: GeoJSON.Feature<GeoJSON.Polygon>;
}

/**
 * Builds a downwind plume cone from each hotspot using live wind direction/speed.
 * Wind direction is meteorological ("from"), so the plume travels at +180deg.
 */
export function smokePlumes(hotspots: Hotspot[], windFromDeg: number, windSpeedKmh: number): PlumeCone[] {
  const bearing = (windFromDeg + 180) % 360;
  const lengthKm = Math.min(18, Math.max(2.5, windSpeedKmh * 0.7));
  const halfAngle = 20;
  return hotspots.map((h) => {
    const origin: [number, number] = [h.lng, h.lat];
    const tip = turf.destination(origin, lengthKm, bearing, { units: 'kilometers' }).geometry.coordinates;
    const left = turf.destination(origin, lengthKm * 0.85, bearing - halfAngle, { units: 'kilometers' }).geometry.coordinates;
    const right = turf.destination(origin, lengthKm * 0.85, bearing + halfAngle, { units: 'kilometers' }).geometry.coordinates;
    const polygon = turf.polygon([[origin, left, tip, right, origin]]);
    return { hotspotId: h.id, polygon };
  });
}

export function compassLabel(deg: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}
