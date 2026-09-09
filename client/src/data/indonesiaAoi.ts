import type { LatLng } from '../types';

/** AOIs named this (case-insensitive) are served from the frozen local dataset instead of a live FIRMS fetch. */
export const INDONESIA_DEMO_NAME = 'Indonesia';

export function isIndonesiaDemoAoi(name: string): boolean {
  return name.trim().toLowerCase() === INDONESIA_DEMO_NAME.toLowerCase();
}

export const INDONESIA_RING: LatLng[] = [
  [2.9729, 95.394], [5.725, 95.0093], [5.7309, 95.0132], [5.7484, 95.0293],
  [5.9044, 95.2152], [5.5685, 126.5916], [-2.6087, 141], [-6.8917, 141.0194],
  [-9.1271, 141.0194], [-9.1296, 141.0194], [-11.0076, 122.8747], [-11.0076, 122.8737],
  [-11.0075, 122.8732], [-7.7333, 107.8445], [-7.4184, 106.5573], [-7.3803, 106.4104],
  [-7.3794, 106.4078], [-7.0139, 105.5174], [-5.516, 102.2793], [-5.4989, 102.2564],
  [-5.3588, 102.097], [-1.687, 98.8617], [-1.6269, 98.8158], [2.9585, 95.3985],
  [2.9729, 95.394],
];
