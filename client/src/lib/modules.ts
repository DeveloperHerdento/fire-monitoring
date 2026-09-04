import type { ModuleMeta } from '../types';

export const MODULES: ModuleMeta[] = [
  {
    id: 'hotspot',
    label: 'Hotspot',
    full: 'Active Fire Hotspot Detection Map',
    sub: 'Live thermal-anomaly detections inside your AOI from VIIRS & MODIS, refreshed on every satellite pass.',
    live: true,
  },
  {
    id: 'timeline',
    label: 'Timeline',
    full: 'Fire Timeline & Landscape Change Map',
    sub: 'Step through detections across the selected day range to see how activity moved across the AOI.',
    live: true,
  },
  {
    id: 'impact',
    label: 'Nearby Impact',
    full: 'Fire Nearby Impact Map',
    sub: 'A 1 km impact radius around every detection, so you can see what sits near each fire — not just the AOI edge.',
    live: true,
  },
  {
    id: 'burned',
    label: 'Burned Area',
    full: 'Burned Area Map',
    sub: 'Estimated footprint from clustered, recurring hotspot detections — a proxy for burn extent, not a satellite-verified dNBR burn scar.',
    live: true,
  },
  {
    id: 'smoke',
    label: 'Smoke',
    full: 'Smoke Detection Map',
    sub: 'Estimated downwind plume from active hotspots, using live wind data at the AOI. Not an aerosol-imagery smoke detection.',
    live: true,
  },
];
