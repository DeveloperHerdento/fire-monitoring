import { useState } from 'react';
import type { LatLng } from '../types';
import { formatHa } from '../lib/geo';

interface Props {
  ring: LatLng[];
  areaHa: number;
  onSave: (name: string) => void;
  onCancel: () => void;
}

export default function AoiFormModal({ ring, areaHa, onSave, onCancel }: Props) {
  const [name, setName] = useState('');

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm bg-surface rounded-2xl shadow-xl p-6">
        <h3 className="text-lg font-bold mb-4">Save New AOI</h3>

        <label className="block text-xs font-semibold text-ink-soft mb-1.5">AOI Name</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Concession Block C"
          className="w-full border border-line rounded-xl px-3 py-2 text-sm mb-4 bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-[#ec3013]/30 focus:border-[#ec3013]"
        />

        <div className="flex items-center justify-between text-sm text-ink-soft mb-1.5">
          <span>Vertices</span>
          <span className="font-semibold text-ink">{ring.length}</span>
        </div>
        <div className="bg-fire-50 text-fire-900 rounded-xl px-3 py-2 text-sm font-semibold mb-5">
          Area: {formatHa(areaHa)}
        </div>

        <button
          disabled={!name.trim()}
          onClick={() => onSave(name.trim())}
          className="w-full bg-[#ec3013] disabled:bg-line disabled:text-ink-faint text-white font-semibold rounded-xl py-2.5 mb-2 hover:bg-[#c22910] transition-colors"
        >
          Save AOI & Fetch Fire Data
        </button>
        <button onClick={onCancel} className="w-full border border-line text-[#ec3013] font-semibold rounded-xl py-2.5 hover:bg-canvas transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}
