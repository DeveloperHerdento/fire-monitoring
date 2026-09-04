import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet-draw';
import type { LatLng } from '../types';
import { polygonAreaHa } from '../lib/geo';

const DEFAULT_CENTER: LatLng = [-2.5, 118]; // Indonesia, country-level view

interface Props {
  onDrawChange: (ring: LatLng[] | null, areaHa: number) => void;
  onSave: () => void;
  onCancel: () => void;
  hasDraft: boolean;
}

export default function DrawAoiMap({ onDrawChange, onSave, onCancel, hasDraft }: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const drawnLayerRef = useRef<L.FeatureGroup | null>(null);

  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const map = L.map(elRef.current, { zoomControl: true }).setView(DEFAULT_CENTER, 5);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri',
      maxZoom: 18,
    }).addTo(map);

    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    drawnLayerRef.current = drawnItems;

    const drawControl = new (L as any).Control.Draw({
      position: 'topleft',
      draw: {
        polygon: {
          shapeOptions: { color: '#ec3013', weight: 2, fillColor: '#ec3013', fillOpacity: 0.15 },
          allowIntersection: false,
          showArea: false,
        },
        polyline: false,
        rectangle: { shapeOptions: { color: '#ec3013', weight: 2, fillColor: '#ec3013', fillOpacity: 0.15 }, showArea: false },
        circle: false,
        circlemarker: false,
        marker: false,
      },
      edit: { featureGroup: drawnItems, remove: true },
    });
    map.addControl(drawControl);

    const emitChange = () => {
      const layers = drawnItems.getLayers();
      if (layers.length === 0) {
        onDrawChange(null, 0);
        return;
      }
      const layer = layers[0] as L.Polygon;
      const latlngs = (layer.getLatLngs()[0] as L.LatLng[]).map((p) => [p.lat, p.lng] as LatLng);
      onDrawChange(latlngs, polygonAreaHa(latlngs));
    };

    map.on((L as any).Draw.Event.CREATED, (e: any) => {
      drawnItems.clearLayers();
      drawnItems.addLayer(e.layer);
      emitChange();
    });
    map.on((L as any).Draw.Event.EDITED, emitChange);
    map.on((L as any).Draw.Event.DELETED, emitChange);

    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 150);

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative h-full min-h-[420px]">
      <div ref={elRef} className="absolute inset-0" />
      {hasDraft && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-[500] bg-surface rounded-xl shadow-lg border border-line px-4 py-3 flex items-center gap-3">
          <span className="text-sm text-ink-soft">AOI drawn — ready to save.</span>
          <button onClick={onCancel} className="text-sm font-semibold text-ink-soft hover:text-ink px-3 py-1.5 rounded-lg border border-line">
            Discard
          </button>
          <button onClick={onSave} className="text-sm font-semibold text-white bg-[#ec3013] hover:bg-[#c22910] px-4 py-1.5 rounded-lg">
            Save AOI
          </button>
        </div>
      )}
      {!hasDraft && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[500] bg-surface/95 backdrop-blur rounded-lg shadow border border-line px-4 py-2 text-xs font-medium text-ink-soft">
          Use the polygon or rectangle tool (top-left) to draw your Area of Interest
        </div>
      )}
    </div>
  );
}
