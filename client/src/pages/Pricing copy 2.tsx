import { Fragment } from 'react';

interface PlanHead {
  id: string;
  name: string;
  price: string;
  priceSub?: string;
  tagline: string;
  cta: string;
  highlight?: boolean;
}

const PLAN_HEADS: PlanHead[] = [
  { id: 'free', name: 'Free', price: 'Rp 0', priceSub: 'forever', tagline: 'Try the map before you commit.', cta: 'Start for free' },
  { id: 'basic', name: 'Basic', price: 'Rp 18.000.000', priceSub: '/month', tagline: 'One area, monitored properly.', cta: 'Choose Basic' },
  { id: 'essential', name: 'Essential', price: 'Rp 40.000.000', priceSub: '/month', tagline: 'For teams watching a few sites.', cta: 'Choose Essential' },
  { id: 'professional', name: 'Professional', price: 'Rp 60.000.000', priceSub: '/month', tagline: 'Daily intelligence, up to 10 sites.', cta: 'Choose Professional', highlight: true },
  { id: 'enterprise', name: 'Enterprise', price: 'Custom', priceSub: 'talk to us', tagline: 'Large-scale, white-labeled, your terms.', cta: 'Contact sales' },
];

// Cell value: true/false renders a check or dash; a string renders as short text (for graded features).
type Cell = boolean | string;
interface FeatureRow {
  label: string;
  values: [Cell, Cell, Cell, Cell, Cell]; // Free, Basic, Essential, Professional, Enterprise
}
interface FeatureGroup {
  title: string;
  rows: FeatureRow[];
}

const GROUPS: FeatureGroup[] = [
  {
    title: 'Coverage & frequency',
    rows: [
      { label: 'Monitored areas', values: ['1 (view only)', '1', 'Up to 3', 'Up to 10', 'Custom / large-scale'] },
      { label: 'Monitoring frequency', values: ['On-demand', 'Monthly', 'Weekly', 'Daily', 'Custom'] },
    ],
  },
  {
    title: 'Detection & alerts',
    rows: [
      { label: 'Active fire hotspot detection', values: [true, true, true, true, true] },
      { label: 'Alerts & notifications', values: [false, false, 'Alerts + email', 'Automated alerts', 'Custom alert rules'] },
    ],
  },
  {
    title: 'Analysis',
    rows: [
      { label: 'Fire timeline (before → during → after)', values: ['Sample only', 'Basic timeline', 'Before / after', 'Full before → during → after', 'Custom'] },
      { label: 'Burned area mapping', values: ['Sample view', 'Visualization', 'Included', 'Advanced assessment', 'Custom'] },
      { label: 'Nearby impact analysis', values: [false, false, true, 'Nearby asset impact', 'Custom risk model'] },
      { label: 'Smoke monitoring', values: [false, false, false, true, true] },
      { label: 'Historical fire analytics', values: ['Limited', 'Included', 'Extended', 'Recurrence analysis', 'Custom'] },
      { label: 'Fire Risk Score / "why is this risky?"', values: [false, false, false, true, 'Custom risk model'] },
    ],
  },
  {
    title: 'Reporting & data',
    rows: [
      { label: 'Incident reports', values: [false, '1 / month', 'Up to 3 / month', 'Up to 10 / month', 'Automated, unlimited'] },
      { label: 'Imagery resolution', values: ['Standard', 'Standard', 'Standard', 'High-res allowance', 'Commercial high-res'] },
      { label: 'API / GIS integration', values: [false, false, false, 'Optional', true] },
    ],
  },
  {
    title: 'Platform & support',
    rows: [
      { label: 'Interactive dashboard', values: ['Basic map', 'Interactive map', 'Interactive map', 'Interactive map', 'Custom dashboard'] },
      { label: 'Multi-user & role management', values: [false, false, false, false, true] },
      { label: 'White-label solution', values: [false, false, false, false, true] },
      { label: 'Support', values: ['Community', 'Standard', 'Standard', 'Priority', 'Dedicated CSM + SLA'] },
    ],
  },
];

export default function Pricing() {
  return (
    <div className="px-4 sm:px-8 py-8 sm:py-12 pb-16 max-w-[1500px] mx-auto">
      <div className="text-center max-w-2xl mx-auto mb-10">
        <span className="inline-block text-[10px] font-bold uppercase tracking-wide bg-[#ffe0d9] text-[#ae1800] px-2.5 py-1 rounded-full mb-3">
          Pricing
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold mb-2">Fire monitoring, sized to how much land you watch</h1>
        <p className="text-ink-soft text-sm sm:text-base">
          Every plan runs on the same live NASA FIRMS data. Higher tiers unlock more areas, faster refresh, and deeper analysis.
        </p>
      </div>

      {/* Plan headers — short, uniform content so every card is naturally the same height */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-stretch mb-10">
        {PLAN_HEADS.map((plan) => (
          <div
            key={plan.id}
            className={`relative flex flex-col h-full rounded-2xl border p-5 transition-all duration-200 ${
              plan.highlight ? 'border-[#ec3013] shadow-lg lg:-translate-y-2 bg-white' : 'border-line bg-white shadow-sm hover:shadow-md'
            }`}
          >
            {plan.highlight && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-wide bg-[#ec3013] text-white px-3 py-1 rounded-full whitespace-nowrap">
                Most popular
              </span>
            )}
            <div className="font-[Manrope] font-extrabold text-lg mb-1">{plan.name}</div>
            <p className="text-xs text-ink-faint mb-4 leading-relaxed flex-1">{plan.tagline}</p>
            <div className="mb-4">
              <div className="font-[Manrope] font-extrabold text-2xl text-ink tabular-nums leading-tight">{plan.price}</div>
              {plan.priceSub && <div className="text-xs text-ink-faint mt-0.5">{plan.priceSub}</div>}
            </div>
            <button
              className={`w-full rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                plan.highlight
                  ? 'bg-[#ec3013] hover:bg-[#c22910] text-white shadow-sm'
                  : plan.id === 'enterprise'
                  ? 'border border-line text-ink hover:bg-canvas'
                  : 'bg-canvas text-ink hover:bg-line-soft'
              }`}
            >
              {plan.cta}
            </button>
          </div>
        ))}
      </div>

      {/* Full feature checklist */}
      <div className="bg-white border border-line rounded-2xl shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[860px] border-collapse">
          <thead>
            <tr className="text-left text-[10.5px] uppercase tracking-wide text-ink-faint bg-canvas">
              <th className="px-4 py-3 font-semibold w-[260px]">Feature</th>
              {PLAN_HEADS.map((p) => (
                <th key={p.id} className={`px-3 py-3 font-semibold text-center ${p.highlight ? 'bg-[#fff2ee] text-[#ae1800]' : ''}`}>
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GROUPS.map((group) => (
              <Fragment key={group.title}>
                <tr className="bg-canvas/60">
                  <td colSpan={6} className="px-4 py-2 text-[10.5px] font-bold uppercase tracking-wide text-ink-faint">
                    {group.title}
                  </td>
                </tr>
                {group.rows.map((row) => (
                  <tr key={row.label} className="border-t border-line-soft hover:bg-canvas/40 transition-colors">
                    <td className="px-4 py-2.5 text-ink-soft">{row.label}</td>
                    {row.values.map((cell, i) => (
                      <td
                        key={i}
                        className={`px-3 py-2.5 text-center ${PLAN_HEADS[i].highlight ? 'bg-[#fff2ee]/50' : ''}`}
                      >
                        {typeof cell === 'boolean' ? (
                          cell ? <CheckIcon /> : <span className="text-line">–</span>
                        ) : (
                          <span className="text-xs text-ink font-medium">{cell}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-center text-xs text-ink-faint mt-10">
        Prices in IDR, billed monthly. Need something between tiers, or a pilot on one AOI first?{' '}
        <span className="text-[#ec3013] font-semibold cursor-pointer hover:underline">Talk to us</span>.
      </p>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ec3013" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="inline-block">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
