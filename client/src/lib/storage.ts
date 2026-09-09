import type { Aoi } from '../types';
import { KALIMANTAN_DEMO_NAME, KALIMANTAN_RING, isKalimantanDemoAoi } from '../data/kalimantanAoi';
import { INDONESIA_DEMO_NAME, INDONESIA_RING, isIndonesiaDemoAoi } from '../data/indonesiaAoi';
import { polygonAreaHa } from './geo';

const AOI_KEY = 'fm.aois.v1';
const ACTIVE_KEY = 'fm.activeAoiId.v1';

function kalimantanAoi(): Aoi {
  return {
    id: `aoi_kalimantan_${Date.now()}`,
    name: KALIMANTAN_DEMO_NAME,
    createdAt: new Date().toISOString(),
    ring: KALIMANTAN_RING,
    areaHa: polygonAreaHa(KALIMANTAN_RING),
    isDemo: true,
  };
}

function indonesiaAoi(): Aoi {
  return {
    id: `aoi_indonesia_${Date.now()}`,
    name: INDONESIA_DEMO_NAME,
    createdAt: new Date().toISOString(),
    ring: INDONESIA_RING,
    areaHa: polygonAreaHa(INDONESIA_RING),
    isDemo: true,
  };
}

export function loadAois(): Aoi[] {
  let aois: Aoi[] = [];
  try {
    const raw = localStorage.getItem(AOI_KEY);
    aois = raw ? JSON.parse(raw) : [];
  } catch {
    aois = [];
  }
  // Any AOI named "Kalimantan" (drawn by hand or from a prior session) is snapped
  // to the real province outline and served from the frozen demo dataset, instead
  // of whatever rough shape it was originally drawn as.
  if (aois.some((a) => isKalimantanDemoAoi(a.name))) {
    aois = aois.map((a) =>
      isKalimantanDemoAoi(a.name) ? { ...a, ring: KALIMANTAN_RING, areaHa: polygonAreaHa(KALIMANTAN_RING), isDemo: true } : a
    );
  } else {
    aois = [kalimantanAoi(), ...aois];
  }
  if (aois.some((a) => isIndonesiaDemoAoi(a.name))) {
    aois = aois.map((a) =>
      isIndonesiaDemoAoi(a.name) ? { ...a, ring: INDONESIA_RING, areaHa: polygonAreaHa(INDONESIA_RING), isDemo: true } : a
    );
  } else {
    aois = [...aois, indonesiaAoi()];
  }
  return aois;
}

export function saveAois(aois: Aoi[]) {
  localStorage.setItem(AOI_KEY, JSON.stringify(aois));
}

export function loadActiveAoiId(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}

export function saveActiveAoiId(id: string | null) {
  if (id) localStorage.setItem(ACTIVE_KEY, id);
  else localStorage.removeItem(ACTIVE_KEY);
}
