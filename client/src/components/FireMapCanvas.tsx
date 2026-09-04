import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { Hotspot, LatLng, ModuleId } from '../types';
import { tierColor, confidenceLabel, formatWibDate, formatWibTime } from '../lib/format';
import { fireFootprintByTier, smokePlumes } from '../lib/geo';
import type { Weather } from '../lib/api';

interface Props {
  ring: LatLng[] | null;
  hotspots: Hotspot[];
  module: ModuleId;
  showBoundary: boolean;
  opacity: number; // 0-100
  weather?: Weather | null;
  interactive?: boolean;
  className?: string;
  onReady?: (map: L.Map) => void;
}

const radiusForTier = (tier: string) => (tier === 'high' ? 9 : tier === 'nominal' ? 7 : 6);
const FOOTPRINT_COLOR: Record<string, string> = { high: '#ae1800', nominal: '#ec3013', low: '#ffc4b8' };

export default function FireMapCanvas({ ring, hotspots, module, showBoundary, opacity, weather, interactive = true, className, onReady }: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const groupRef = useRef<L.LayerGroup | null>(null);
  const fittedRef = useRef(false);

  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const map = L.map(elRef.current, {
      zoomControl: false,
      dragging: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      boxZoom: interactive,
      keyboard: interactive,
      touchZoom: interactive,
      attributionControl: interactive,
    }).setView([-2.5, 118], 5);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri',
      maxZoom: 18,
    }).addTo(map);
    groupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    onReady?.(map);
    setTimeout(() => map.invalidateSize(), 150);
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const group = groupRef.current;
    if (!map || !group) return;
    group.clearLayers();
    const areaOpacity = opacity / 100;

    if (ring && ring.length >= 3) {
      if (showBoundary) {
        L.polygon(ring, { color: '#16171b', weight: 2, dashArray: '6,5', fill: false }).addTo(group);
      }
      if (!fittedRef.current) {
        map.fitBounds(L.polygon(ring).getBounds().pad(0.35));
        fittedRef.current = true;
      }
    }

    if (module === 'impact') {
      // Per-point impact radius — what's near THIS fire, not distance to the AOI edge.
      hotspots.forEach((h) => {
        L.circle([h.lat, h.lng], {
          radius: 1000,
          color: tierColor(h.confidence),
          weight: 1.5,
          dashArray: '3,4',
          fillColor: tierColor(h.confidence),
          fillOpacity: 0.12 * areaOpacity,
          opacity: 0.8 * areaOpacity,
        }).addTo(group);
      });
    }

    if (module === 'burned') {
      fireFootprintByTier(hotspots).forEach(({ tier, polygon }) => {
        if (!polygon) return;
        const geoms = polygon.geometry.type === 'Polygon' ? [polygon.geometry.coordinates] : polygon.geometry.coordinates;
        geoms.forEach((rings) => {
          const latlngs = rings.map((r) => r.map(([lng, lat]) => [lat, lng] as LatLng));
          L.polygon(latlngs, { color: FOOTPRINT_COLOR[tier], weight: 1, fillColor: FOOTPRINT_COLOR[tier], fillOpacity: 0.6 * areaOpacity }).addTo(group);
        });
      });
    }

    if (module === 'smoke' && weather?.windDirectionDeg != null && weather.windSpeedKmh != null) {
      smokePlumes(hotspots, weather.windDirectionDeg, weather.windSpeedKmh).forEach(({ polygon }) => {
        const latlngs = polygon.geometry.coordinates[0].map(([lng, lat]) => [lat, lng] as LatLng);
        L.polygon(latlngs, { color: 'transparent', fillColor: '#8a8d94', fillOpacity: 0.4 * areaOpacity }).addTo(group);
      });
    }

    if (module !== 'burned') {
      hotspots.forEach((h) => {
        const marker = L.circleMarker([h.lat, h.lng], {
          radius: radiusForTier(h.confidence),
          color: '#fff',
          weight: 2,
          fillColor: tierColor(h.confidence),
          fillOpacity: (module === 'smoke' ? 0.75 : 0.92) * areaOpacity,
        });
        const statusText =
          h.distanceToBoundaryKm === undefined ? '—' : h.inAoi ? 'Inside AOI' : `${h.distanceToBoundaryKm} km from AOI`;
        const row = (label: string, value: string) =>
          `<span style="color:#8a8d94">${label}</span><span style="color:#16171b;font-weight:600">${value}</span>`;
        marker.bindPopup(
          `<div style="font-family:Inter,sans-serif;font-size:12px;min-width:190px">` +
            `<div style="font-weight:800;font-size:13px;margin-bottom:6px;color:${tierColor(h.confidence)}">${confidenceLabel(h.confidence)} confidence</div>` +
            `<div style="display:grid;grid-template-columns:68px 1fr;row-gap:4px;column-gap:8px;line-height:1.4">` +
            row('Date', formatWibDate(h.acqDate, h.acqTime)) +
            row('Time', formatWibTime(h.acqDate, h.acqTime)) +
            row('Location', `${h.lat.toFixed(4)}, ${h.lng.toFixed(4)}`) +
            row('Satellite', `${h.satellite} ${h.instrument}`) +
            row('FRP', `${h.frp ?? '—'} MW`) +
            row('Status', statusText) +
            `</div>` +
            `</div>`
        );
        marker.addTo(group);
      });
    }
  }, [ring, hotspots, module, showBoundary, opacity, weather]);

  useEffect(() => {
    fittedRef.current = false;
  }, [ring]);

  return <div ref={elRef} className={className ?? 'absolute inset-0'} />;
}
