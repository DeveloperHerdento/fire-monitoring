import { HashRouter, Route, Routes } from 'react-router-dom';
import { AoiProvider } from './state/AoiContext';
import TopNav from './components/TopNav';
import Dashboard from './pages/Dashboard';
import FieldManagement from './pages/FieldManagement';
import Analytics from './pages/Analytics';
import Pricing from './pages/Pricing';

export default function App() {
  return (
    <AoiProvider>
      <HashRouter>
        <div className="min-h-screen h-screen flex flex-col bg-white text-ink overflow-hidden">
          <TopNav />
          <main className="flex-1 min-h-0 overflow-y-auto pb-16 sm:pb-0">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/field" element={<FieldManagement />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/pricing" element={<Pricing />} />
            </Routes>
          </main>
        </div>
      </HashRouter>
    </AoiProvider>
  );
}
