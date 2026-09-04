import { Fragment } from 'react';

interface PlanHead {
  id: string;
  name: string;
  price: string;
  priceSub?: string;
  tagline: string;
  highlight?: boolean;
}

const PLAN_HEADS: PlanHead[] = [
  { id: 'free', name: 'Free', price: 'Rp 0', priceSub: '/month', tagline: 'Try the map before you commit.' },
  { id: 'basic', name: 'Basic', price: 'Rp 18.000.000', priceSub: '/month', tagline: 'One area, monitored properly.' },
  { id: 'essential', name: 'Essential', price: 'Rp 40.000.000', priceSub: '/month', tagline: 'For teams watching a few sites.' },
  { id: 'professional', name: 'Professional', price: 'Rp 60.000.000', priceSub: '/month', tagline: 'Daily intelligence, up to 10 sites.', highlight: true },
  { id: 'enterprise', name: 'Enterprise', price: 'Custom', priceSub: 'talk to us', tagline: 'Large-scale, white-labeled, your terms.' },
];

// Fitur spesifik/tambahan untuk masing-masing tier saja
const TIER_FEATURES: Record<string, string[]> = {
  free: [
    '1 Monitored area (view only)',
    'On-demand monitoring',
    'Active fire hotspot detection',
    'Sample fire timeline & burned area view',
    'Basic map & community support',
  ],
  basic: [
    '1 Monitored area (full access)',
    'Monthly monitoring refresh',
    'Basic timeline & burned area visualization',
    '1 Incident report / month',
    'Standard imagery resolution',
    'Interactive map & standard support',
  ],
  essential: [
    'Up to 3 Monitored areas',
    'Weekly monitoring refresh',
    'Alerts & email notifications',
    'Before / after timeline & burned area mapping',
    'Nearby impact analysis',
    'Up to 3 Incident reports / month',
    'Extended historical analytics',
  ],
  professional: [
    'Up to 10 Monitored areas',
    'Daily monitoring refresh',
    'Automated alerts & smoke monitoring',
    'Full before → during → after timeline',
    'Advanced burned area & nearby asset impact assessment',
    'Fire Risk Score / risk analytics',
    'Up to 10 Incident reports / month',
    'High-res imagery allowance & optional API',
    'Priority support',
  ],
  enterprise: [
    'Custom / large-scale monitored areas',
    'Custom monitoring frequency',
    'Custom alert rules & risk model',
    'Automated, unlimited incident reports',
    'Commercial high-res imagery & full API / GIS',
    'Custom dashboard & white-label solution',
    'Dedicated CSM + SLA',
  ],
};

export default function Pricing() {
  return (
    <div className="px-4 sm:px-8 py-8 sm:py-12 pb-16 max-w-[1500px] mx-auto">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto mb-10">
        <span className="inline-block text-[10px] font-bold uppercase tracking-wide bg-[#ffe0d9] text-[#ae1800] px-2.5 py-1 rounded-full mb-3">
          Pricing
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold mb-2">Fire monitoring, sized to how much land you watch</h1>
        {/* <p className="text-ink-soft text-sm sm:text-base">
          Every plan runs on the same live NASA FIRMS data. Higher tiers unlock more areas, faster refresh, and deeper analysis.
        </p> */}
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 items-stretch">
        {PLAN_HEADS.map((plan) => (
          <div
            key={plan.id}
            className={`relative flex flex-col h-full rounded-2xl border p-6 transition-all duration-200 ${
              plan.highlight
                ? 'border-[#ec3013] shadow-xl bg-white ring-1 ring-[#ec3013]'
                : 'border-line bg-white shadow-sm hover:shadow-md'
            }`}
          >
            {/* Highlight Badge */}
            {plan.highlight && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-wide bg-[#ec3013] text-white px-3 py-1 rounded-full whitespace-nowrap">
                Recommended
              </span>
            )}

            {/* Header Section (Nama, Tagline, Harga) */}
            <div className="border-b border-line-soft pb-5 mb-5">
              <div className="font-[Manrope] font-extrabold text-xl mb-1">{plan.name}</div>
              <p className="text-xs text-ink-faint mb-4 leading-relaxed min-h-[36px]">{plan.tagline}</p>
              <div>
                <div className="font-[Manrope] font-extrabold text-2xl text-ink tabular-nums leading-tight">{plan.price}</div>
                {plan.priceSub && <div className="text-xs text-ink-faint mt-0.5">{plan.priceSub}</div>}
              </div>
            </div>

            {/* Feature List */}
            <div className="flex-1 text-xs">
                <div className="font-semibold text-ink-soft mb-3 text-[11px] uppercase tracking-wide">
                </div>
              <ul className="space-y-2.5">
                {TIER_FEATURES[plan.id].map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-ink-soft leading-snug">
                    <span className="text-[#ec3013] font-bold text-sm leading-none shrink-0">•</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      {/* Footer Text */}
      <p className="text-center text-xs text-ink-faint mt-10">
        Prices in IDR, billed monthly. Need something between tiers, or a pilot on one AOI first?{' '}
        <span className="text-[#ec3013] font-semibold cursor-pointer hover:underline">Talk to us</span>.
      </p>
    </div>
  );
}