import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import DashboardPage from './pages/DashboardPage';
import DealsPage from './pages/DealsPage';
import NewListingsPage from './pages/NewListingsPage';
import WatchlistPage from './pages/WatchlistPage';
import BikeDatabasePage from './pages/BikeDatabasePage';
import TubingDatabasePage from './pages/TubingDatabasePage';
import GroupsetsPage from './pages/GroupsetsPage';
import HistoryPage from './pages/HistoryPage';
import SelectionPage from './pages/SelectionPage';
import SettingsPage from './pages/SettingsPage';
import ListingPage from './pages/ListingPage';

// Leaflet is the heaviest dependency — load the map only when needed.
const MapPage = lazy(() => import('./pages/MapPage'));
const FrameModelPage = lazy(() => import('./pages/FrameModelPage'));
const FramesPage = lazy(() => import('./pages/FramesPage'));

export default function App() {
  return (
    <Layout>
      <ErrorBoundary>
      <Suspense fallback={<div className="py-20 text-center text-sm text-ink-500">Ładowanie…</div>}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/deals" element={<DealsPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/new" element={<NewListingsPage />} />
          <Route path="/watchlist" element={<WatchlistPage />} />
          <Route path="/bikes" element={<BikeDatabasePage />} />
          <Route path="/tubing" element={<TubingDatabasePage />} />
          <Route path="/groupsets" element={<GroupsetsPage />} />
          <Route path="/selection" element={<SelectionPage />} />
          <Route path="/frames" element={<FramesPage />} />
          <Route path="/frames/:id" element={<FrameModelPage />} />
          <Route path="/model/stumpjumper-comp-1990" element={<Navigate to="/frames/stumpjumper-comp-1990" replace />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/listing/:id" element={<ListingPage />} />
          <Route path="*" element={<DashboardPage />} />
        </Routes>
      </Suspense>
      </ErrorBoundary>
    </Layout>
  );
}
