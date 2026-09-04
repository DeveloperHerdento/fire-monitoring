export function formatAcqTime(acqTime: string): string {
  const t = acqTime.padStart(4, '0');
  return `${t.slice(0, 2)}:${t.slice(2)} UTC`;
}

export function formatAcqDate(acqDate: string): string {
  const d = new Date(`${acqDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return acqDate;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });
}

/** FIRMS timestamps are UTC — shift +7h to WIB (Waktu Indonesia Barat) for display. */
function toWibDate(acqDate: string, acqTime: string): Date {
  const t = acqTime.padStart(4, '0');
  const utc = new Date(`${acqDate}T${t.slice(0, 2)}:${t.slice(2)}:00Z`);
  return new Date(utc.getTime() + 7 * 3600 * 1000);
}

export function formatWibTime(acqDate: string, acqTime: string): string {
  const d = toWibDate(acqDate, acqTime);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm} WIB`;
}

export function formatWibDate(acqDate: string, acqTime: string): string {
  const d = toWibDate(acqDate, acqTime);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });
}

export function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function tierColor(tier: 'high' | 'nominal' | 'low' | string): string {
  return { high: '#ae1800', nominal: '#ec3013', low: '#ffc4b8' }[tier] || '#ec3013';
}

export function tierBg(tier: 'high' | 'nominal' | 'low' | string): { bg: string; fg: string } {
  return (
    {
      high: { bg: '#ffe0d9', fg: '#7c1405' },
      nominal: { bg: '#ffe9e2', fg: '#ae1800' },
      low: { bg: '#f4f0f0', fg: '#55585f' },
    }[tier] || { bg: '#eee', fg: '#333' }
  );
}

/** Display label for a confidence tier — internal key stays 'nominal' (matches FIRMS), UI shows "Medium". */
export function confidenceLabel(tier: 'high' | 'nominal' | 'low' | string): string {
  return { high: 'High', nominal: 'Medium', low: 'Low' }[tier] ?? tier;
}
