export type ConfidenceTier = 'high' | 'nominal' | 'low';

export interface Hotspot {
  id: string;
  source: string;
  lat: number;
  lng: number;
  acqDate: string; // YYYY-MM-DD
  acqTime: string; // HHMM, no colon
  satellite: string;
  instrument: string;
  confidenceRaw: string;
  confidence: ConfidenceTier;
  frp: number | null;
  daynight: string;
  brightness: number | null;
  inAoi?: boolean;
  distanceToBoundaryKm?: number;
}

export interface FiresResponse {
  bbox: string;
  dayRange: number;
  sources: string[];
  fetchedAt: string;
  count: number;
  hotspots: Hotspot[];
  cached?: boolean;
  errors?: Array<{ source: string; status?: number; snippet?: string; error?: string }>;
}

export type LatLng = [number, number];

export interface Aoi {
  id: string;
  name: string;
  createdAt: string;
  ring: LatLng[]; // polygon ring, [lat, lng][], closed or open
  areaHa: number;
}

export type SourceId = 'VIIRS_SNPP_NRT' | 'VIIRS_NOAA20_NRT' | 'VIIRS_NOAA21_NRT' | 'MODIS_NRT';

export type ModuleId = 'hotspot' | 'timeline' | 'burned' | 'impact' | 'smoke';

export interface ModuleMeta {
  id: ModuleId;
  label: string;
  full: string;
  sub: string;
  live: boolean;
}
