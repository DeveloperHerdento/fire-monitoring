import type { Aoi } from '../types';

const AOI_KEY = 'fm.aois.v1';
const ACTIVE_KEY = 'fm.activeAoiId.v1';

export function loadAois(): Aoi[] {
  try {
    const raw = localStorage.getItem(AOI_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
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
