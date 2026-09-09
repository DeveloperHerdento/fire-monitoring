import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import '../lib/leafletVelocitySetup';
import 'leaflet-velocity';
import 'leaflet-velocity/dist/leaflet-velocity.css';
import type { Hotspot, LatLng, ModuleId } from '../types';
import { tierColor, confidenceLabel, formatWibDate, formatWibTime } from '../lib/format';
import { fireFootprintByTier, smokePlumes, type WindSample } from '../lib/geo';
import { fetchWindGrid } from '../lib/api';

interface Props {
  ring: LatLng[] | null;
  hotspots: Hotspot[];
  module: ModuleId;
  showBoundary: boolean;
  opacity: number; // 0-100
  windGrid?: WindSample[];
  /** YYYY-MM-DD — shows the NASA GIBS VIIRS Deep Blue Aerosol Type layer for that day. Null/undefined hides it (this product is per-day satellite imagery, not a continuous window). */
  satelliteSmokeDate?: string | null;
  /** Animated wind-vector field (leaflet-velocity) over the current map view — independent of `module`, since it's useful context under any of them. */
  showWindLayer?: boolean;
  /** Fade each redraw in instead of popping instantly — used during time-lapse playback so frames don't flash. */
  animate?: boolean;
  interactive?: boolean;
  className?: string;
  onReady?: (map: L.Map) => void;
}

// NASA GIBS — VIIRS/SNPP Deep Blue Aerosol Type (NRT "Land_Ocean" variant, not
// "Best_Estimate" which lags several weeks behind and would be empty for recent
// dates). Categorical: Dust / Smoke / High-Altitude Smoke / Pyrocumulonimbus,
// classified straight from satellite imagery — the same style of product BMKG's
// own smoke analysis is built from, just pre-rendered by NASA instead of by us.
// Max native zoom is 6 (GoogleMapsCompatible_Level6) — this product is coarse.
const GIBS_SMOKE_LAYER = 'VIIRS_SNPP_Aerosol_Type_Deep_Blue_Land_Ocean';
function gibsSmokeUrl(date: string) {
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${GIBS_SMOKE_LAYER}/default/${date}/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png`;
}

const radiusForTier = (tier: string) => (tier === 'high' ? 9 : tier === 'nominal' ? 7 : 6);
const FOOTPRINT_COLOR: Record<string, string> = { high: '#ae1800', nominal: '#ec3013', low: '#ffc4b8' };

const CLUSTER_TEXT_COLOR: Record<string, string> = { high: '#fff', nominal: '#fff', low: '#7c1405' };

// Clustered dot at low zoom shows a count instead of thousands of individual
// points; spidering apart into real markers as you zoom into their true locations.
// Color reflects the highest confidence tier present among the clustered points
// (same red scale as individual markers), size reflects how many are grouped.
function clusterIcon(cluster: L.MarkerCluster) {
  const count = cluster.getChildCount();
  const children = cluster.getAllChildMarkers() as Array<L.Layer & { __confidence?: string }>;
  let tier: 'high' | 'nominal' | 'low' = 'low';
  for (const child of children) {
    if (child.__confidence === 'high') { tier = 'high'; break; }
    if (child.__confidence === 'nominal') tier = 'nominal';
  }
  const size = count < 10 ? 32 : count < 100 ? 40 : 50;
  const bg = tierColor(tier);
  const fg = CLUSTER_TEXT_COLOR[tier];
  return L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};color:${fg};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:${count < 100 ? 12 : 13}px;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)">${count}</div>`,
    className: 'fm-cluster-icon',
    iconSize: L.point(size, size),
  });
}

export default function FireMapCanvas({ ring, hotspots, module, showBoundary, opacity, windGrid, satelliteSmokeDate, showWindLayer, animate, interactive = true, className, onReady }: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const groupRef = useRef<L.LayerGroup | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const gibsLayerRef = useRef<L.TileLayer | null>(null);
  const windLayerRef = useRef<L.Layer | null>(null);
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
      // Canvas instead of per-marker SVG DOM nodes — needed to keep pan/zoom smooth
      // once a dataset has thousands of hotspots (e.g. the Kalimantan demo AOI).
      renderer: L.canvas({ padding: 0.5 }),
    }).setView([-2.5, 118], 5);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri',
      maxZoom: 18,
    }).addTo(map);
    groupRef.current = L.layerGroup().addTo(map);
    clusterRef.current = L.markerClusterGroup({
      maxClusterRadius: 60,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      disableClusteringAtZoom: 12,
      iconCreateFunction: clusterIcon,
    }).addTo(map);
    // Fade transition for the "animate" prop — applied to the panes that hold
    // hotspot circles/polygons (canvas-rendered, in overlayPane) and cluster
    // bubbles (DOM divIcons, in markerPane), so a frame swap fades in instead of
    // popping. Left inert (no transition) when animate is false/undefined.
    const overlayPane = map.getPane('overlayPane');
    const markerPane = map.getPane('markerPane');
    if (overlayPane) overlayPane.style.transition = 'opacity 320ms ease-out';
    if (markerPane) markerPane.style.transition = 'opacity 320ms ease-out';

    mapRef.current = map;
    onReady?.(map);
    setTimeout(() => map.invalidateSize(), 150);
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Separate effect: the GIBS satellite-smoke overlay only depends on the date,
  // not on hotspots/AOI/module — recreating it on every hotspot fetch would just
  // re-request the same tiles for no reason.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (gibsLayerRef.current) {
      map.removeLayer(gibsLayerRef.current);
      gibsLayerRef.current = null;
    }
    if (satelliteSmokeDate) {
      gibsLayerRef.current = L.tileLayer(gibsSmokeUrl(satelliteSmokeDate), {
        maxNativeZoom: 6,
        maxZoom: 18,
        opacity: 0.75,
        attribution: 'Smoke imagery: NASA GIBS/Worldview (VIIRS Deep Blue)',
      }).addTo(map);
    }
  }, [satelliteSmokeDate]);

  // Animated wind-vector layer — independent of the hotspot/module redraw below,
  // and refetched (debounced) on pan/zoom since it's sampled over the visible
  // bounds rather than the whole world.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!showWindLayer) {
      if (windLayerRef.current) {
        map.removeLayer(windLayerRef.current);
        windLayerRef.current = null;
      }
      return;
    }

    let cancelled = false;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const load = async () => {
      const b = map.getBounds();
      const bbox: [number, number, number, number] = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
      try {
        const data = await fetchWindGrid(bbox);
        // The fetch is async — bail if this effect was cleaned up (unmount, toggle
        // off, or the map itself was swapped out) while it was in flight, so we
        // never add a velocity layer to a map that's already gone.
        if (cancelled || mapRef.current !== map) return;
        if (windLayerRef.current) map.removeLayer(windLayerRef.current);
        windLayerRef.current = L.velocityLayer({
          displayValues: true,
          displayOptions: { velocityType: 'Wind', position: 'bottomleft', emptyString: 'No wind data' },
          data,
          velocityScale: 0.01,
          colorScale: ['#3288bd', '#66c2a5', '#fee08b', '#f46d43', '#d53e4f'],
        });
        windLayerRef.current.addTo(map);
      } catch (err) {
        console.error('Failed to load wind layer', err);
      }
    };

    load();
    const onMoveEnd = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(load, 500);
    };
    map.on('moveend', onMoveEnd);
    return () => {
      cancelled = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      map.off('moveend', onMoveEnd);
      if (windLayerRef.current) {
        map.removeLayer(windLayerRef.current);
        windLayerRef.current = null;
      }
    };
  }, [showWindLayer]);

  useEffect(() => {
    const map = mapRef.current;
    const group = groupRef.current;
    const cluster = clusterRef.current;
    if (!map || !group || !cluster) return;

    const overlayPane = map.getPane('overlayPane');
    const markerPane = map.getPane('markerPane');
    if (animate) {
      // Drop out instantly (no transition visible — happens before the browser's
      // next paint), redraw invisibly below, then fade the new frame in.
      if (overlayPane) overlayPane.style.opacity = '0';
      if (markerPane) markerPane.style.opacity = '0';
    }

    group.clearLayers();
    cluster.clearLayers();
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

    if (module === 'smoke' && windGrid && windGrid.length > 0) {
      smokePlumes(hotspots, windGrid).forEach(({ polygon }) => {
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
        }) as L.CircleMarker & { __confidence?: string };
        marker.__confidence = h.confidence;
        const statusText =
          h.distanceToBoundaryKm === undefined ? '—' : h.inAoi ? 'Inside AOI' : `${h.distanceToBoundaryKm} km from AOI`;
        const row = (label: string, value: string) =>
          `<span style="color:var(--color-ink-faint)">${label}</span><span style="color:var(--color-ink);font-weight:600">${value}</span>`;
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
        cluster.addLayer(marker);
      });
    }

    if (animate) {
      // Redraw is synchronous above, so the pane is still at opacity 0 here —
      // flip it after paint so the transition actually animates instead of
      // being coalesced with the opacity:0 set earlier in this same tick.
      requestAnimationFrame(() => {
        if (overlayPane) overlayPane.style.opacity = '1';
        if (markerPane) markerPane.style.opacity = '1';
      });
    } else {
      if (overlayPane) overlayPane.style.opacity = '1';
      if (markerPane) markerPane.style.opacity = '1';
    }
  }, [ring, hotspots, module, showBoundary, opacity, windGrid, animate]);

  useEffect(() => {
    fittedRef.current = false;
  }, [ring]);

  return <div ref={elRef} className={className ?? 'absolute inset-0'} />;
}
