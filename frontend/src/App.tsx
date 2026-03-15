import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import './i18n';
import { AuthProvider } from './contexts/AuthContext';
import { SiteConfigProvider } from './contexts/SiteConfigContext';
import { NavLayoutProvider } from './contexts/NavLayoutContext';
import { useNavLayout } from './contexts/navLayoutContext';
import ErrorBoundary from './components/ErrorBoundary';
import ScrollToTop from './components/ScrollToTop';
import NotFound from './components/NotFound';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import TopNav from './components/TopNav';
import Dashboard from './components/Dashboard';
import Standings from './components/Standings';
import ActivityFeed from './components/ActivityFeed';
import Championships from './components/Championships';
import Tournaments from './components/Tournaments';
import MatchSearch from './components/MatchSearch';
import SeasonAwardsPage from './components/SeasonAwardsPage';
import { WikiLayout } from './components/Wiki';
import WikiIndex from './components/WikiIndex';
import WikiArticle from './components/WikiArticle';
import AdminPanel from './components/admin/AdminPanel';
// Auth components
import Login from './components/auth/Login';
// Statistics components
import WrestlerStats from './components/statistics/WrestlerStats';
import HeadToHeadComparison from './components/statistics/HeadToHeadComparison';
import Leaderboards from './components/statistics/Leaderboards';
import RecordBook from './components/statistics/RecordBook';
import BestMatches from './components/statistics/BestMatches';
import Rivalries from './components/statistics/Rivalries';
import TaleOfTheTape from './components/statistics/TaleOfTheTape';
import Achievements from './components/statistics/Achievements';
import MatchTypeLeaderboards from './components/statistics/MatchTypeLeaderboards';
// Contender components
import ContenderRankings from './components/contenders/ContenderRankings';
import MyContenderStatus from './components/contenders/MyContenderStatus';
// Events components
import EventsCalendar from './components/events/EventsCalendar';
import EventDetail from './components/events/EventDetail';
import EventResults from './components/events/EventResults';
// Route guard
import FeatureRoute from './components/FeatureRoute';
import PageTransition from './components/ui/PageTransition';
import ToastProvider from './components/ui/ToastProvider';
import './App.css';

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <ScrollToTop />
        <AuthProvider>
          <SiteConfigProvider>
            <NavLayoutProvider>
              <AppLayout />
            </NavLayoutProvider>
          </SiteConfigProvider>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}

function AppLayout() {
  const { mode } = useNavLayout();
  const location = useLocation();
  return (
    <div className={`App layout-${mode}`}>
      <ToastProvider />
      {mode === 'sidebar' ? (
        <>
          <Sidebar />
          <TopBar />
        </>
      ) : (
        <TopNav />
      )}
      <main>
        <PageTransition key={location.pathname}>
          <Routes>
            {/* Auth Routes */}
            <Route path="/login" element={<Login />} />

            {/* Public Routes */}
            <Route path="/" element={<Dashboard />} />
            <Route path="/standings" element={<Standings />} />
            <Route path="/activity" element={<ActivityFeed />} />
            <Route path="/championships" element={<Championships />} />
            <Route path="/matches" element={<MatchSearch />} />
            <Route path="/tournaments" element={<Tournaments />} />
            <Route path="/awards" element={<SeasonAwardsPage />} />
            <Route path="/guide" element={<Navigate to="/guide/wiki" replace />} />
            <Route path="/guide/wiki" element={<WikiLayout />}>
              <Route index element={<WikiIndex />} />
              <Route path=":slug" element={<WikiArticle />} />
            </Route>

            {/* Admin Routes - Admin only (protected inside AdminPanel) */}
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/admin/:tab" element={<AdminPanel />} />

            {/* Statistics Routes - feature-gated */}
            <Route path="/stats" element={
              <FeatureRoute feature="statistics"><WrestlerStats /></FeatureRoute>
            } />
            <Route path="/stats/wrestler/:wrestlerId" element={
              <FeatureRoute feature="statistics"><WrestlerStats /></FeatureRoute>
            } />
            <Route path="/stats/head-to-head" element={
              <FeatureRoute feature="statistics"><HeadToHeadComparison /></FeatureRoute>
            } />
            <Route path="/stats/leaderboards" element={
              <FeatureRoute feature="statistics"><Leaderboards /></FeatureRoute>
            } />
            <Route path="/stats/records" element={
              <FeatureRoute feature="statistics"><RecordBook /></FeatureRoute>
            } />
            <Route path="/stats/rivalries" element={
              <FeatureRoute feature="statistics"><Rivalries /></FeatureRoute>
            } />
            <Route path="/stats/tale-of-tape" element={
              <FeatureRoute feature="statistics"><TaleOfTheTape /></FeatureRoute>
            } />
            <Route path="/stats/achievements" element={
              <FeatureRoute feature="statistics"><Achievements /></FeatureRoute>
            } />
            <Route path="/stats/best-matches" element={
              <FeatureRoute feature="statistics"><BestMatches /></FeatureRoute>
            } />
            <Route path="/stats/match-types" element={
              <FeatureRoute feature="statistics"><MatchTypeLeaderboards /></FeatureRoute>
            } />

            {/* Events Routes - public */}
            <Route path="/events" element={<EventsCalendar />} />
            <Route path="/events/:eventId" element={<EventDetail />} />
            <Route path="/events/:eventId/results" element={<EventResults />} />

            {/* Contender Routes - feature-gated */}
            <Route path="/contenders" element={
              <FeatureRoute feature="contenders"><ContenderRankings /></FeatureRoute>
            } />
            <Route path="/contenders/my-status" element={
              <FeatureRoute feature="contenders"><MyContenderStatus /></FeatureRoute>
            } />

            {/* Catch-all 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </PageTransition>
      </main>
    </div>
  );
}

export default App;
