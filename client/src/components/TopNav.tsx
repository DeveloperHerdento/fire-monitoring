import { NavLink } from 'react-router-dom';
import { useAoi } from '../state/AoiContext';
import { useTheme } from '../lib/theme';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `text-sm font-semibold transition-colors ${isActive ? 'text-[#ec3013]' : 'text-ink-soft hover:text-ink'}`;

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-bold transition-colors ${isActive ? 'text-[#ec3013]' : 'text-ink-faint'}`;

export default function TopNav() {
  const { activeAoi, inAoiHotspots, status } = useAoi();
  const { theme, toggleTheme } = useTheme();

  return (
    <>
      <header className="sticky top-0 z-50 bg-surface border-b border-line">
        <div className="h-14 sm:h-15 px-4 sm:px-8 flex items-center gap-4 sm:gap-6">
          <span className="flex items-baseline gap-1.5 font-[Manrope] font-extrabold text-base sm:text-lg tracking-tight text-ink shrink-0">
            RATRA <span className="text-[11px] font-semibold text-ink-faint tracking-wider">MAPS</span>
            <span className="ml-1 text-[10px] font-bold bg-fire-100 text-fire-900 px-1.5 py-0.5 rounded-full">FIRE</span>
          </span>

          <div className="hidden sm:flex bg-canvas p-0.5 rounded-full text-xs shrink-0">
            <span className="px-3 py-1.5 text-ink-faint cursor-not-allowed select-none">Agriculture</span>
            <span className="px-3 py-1.5 rounded-full bg-surface shadow-sm font-semibold text-ink">Fire Monitoring</span>
          </div>

          <nav className="hidden sm:flex items-center gap-6 ml-2">
            <NavLink to="/" end className={linkClass}>Dashboard</NavLink>
            <NavLink to="/field" className={linkClass}>Field Management</NavLink>
            <NavLink to="/analytics" className={linkClass}>Analytics</NavLink>
            <NavLink to="/pricing" className={linkClass}>Pricing</NavLink>
          </nav>

          <div className="ml-auto flex items-center gap-2 sm:gap-4">
            {activeAoi && (
              <div className="hidden md:flex items-center gap-2 text-xs text-ink-soft bg-canvas rounded-full pl-2 pr-3 py-1">
                <span
                  className={`w-2 h-2 rounded-full ${status === 'loading' ? 'bg-amber-400 live-dot' : status === 'error' ? 'bg-red-500' : 'bg-emerald-500 live-dot'}`}
                />
                <span className="font-medium text-ink">{activeAoi.name}</span>
                <span className="text-ink-faint">· {inAoiHotspots.length} active</span>
              </div>
            )}
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-canvas text-ink-soft transition-colors"
            >
              {theme === 'dark' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
              )}
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-canvas text-ink-soft transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a5 5 0 0 0-5 5v3.5c0 1-.4 2-1.2 2.8L5 15h14l-.8-.7c-.8-.8-1.2-1.8-1.2-2.8V8a5 5 0 0 0-5-5z"></path><path d="M9.5 18a2.5 2.5 0 0 0 5 0"></path></svg>
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-canvas text-ink-soft transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.5"></circle><path d="M5 20c0-3.5 3.5-6 7-6s7 2.5 7 6"></path></svg>
            </button>
          </div>
        </div>
        {activeAoi && (
          <div className="md:hidden flex items-center gap-2 text-[11px] text-ink-soft bg-canvas px-4 py-1.5 border-t border-line">
            <span className={`w-1.5 h-1.5 rounded-full ${status === 'loading' ? 'bg-amber-400 live-dot' : status === 'error' ? 'bg-red-500' : 'bg-emerald-500 live-dot'}`} />
            <span className="font-medium text-ink truncate">{activeAoi.name}</span>
            <span className="text-ink-faint shrink-0">· {inAoiHotspots.length} active</span>
          </div>
        )}
      </header>

      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-50 h-16 bg-surface border-t border-line flex" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <NavLink to="/" end className={tabClass}>
          <DashIcon /> Dashboard
        </NavLink>
        <NavLink to="/field" className={tabClass}>
          <MapIcon /> Fire Map
        </NavLink>
        <NavLink to="/analytics" className={tabClass}>
          <ChartIcon /> Analytics
        </NavLink>
      </nav>
    </>
  );
}

function DashIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"></rect><rect x="14" y="3" width="7" height="5" rx="1"></rect><rect x="14" y="12" width="7" height="9" rx="1"></rect><rect x="3" y="16" width="7" height="5" rx="1"></rect></svg>;
}
function MapIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon><line x1="8" y1="2" x2="8" y2="18"></line><line x1="16" y1="6" x2="16" y2="22"></line></svg>;
}
function ChartIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>;
}
