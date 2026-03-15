import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Navigate } from 'react-router-dom';

import ManageWrestlers from './ManageWrestlers';
import ManageDivisions from './ManageDivisions';
import ManageMatchConfig from './ManageMatchConfig';
import ScheduleMatch from './ScheduleMatch';
import RecordResult from './RecordResult';
import ManageChampionships from './ManageChampionships';
import CreateTournament from './CreateTournament';

import ManageSeasons from './ManageSeasons';
import CreateEvent from './CreateEvent';
import MatchCardBuilder from './MatchCardBuilder';
import ClearAllData from './ClearAllData';
import ManageFeatures from './ManageFeatures';
import './AdminPanel.css';

import ManageSeasonAwards from './ManageSeasonAwards';
import AdminContenderConfig from './AdminContenderConfig';
import ManageCompanies from './ManageCompanies';
import ManageShows from './ManageShows';

type AdminTab = 'wrestlers' | 'divisions' | 'companies' | 'shows' | 'match-config' | 'schedule' | 'results' | 'championships' | 'tournaments' | 'seasons' | 'season-awards' | 'events' | 'contender-config' | 'danger' | 'features';

const VALID_TABS: AdminTab[] = ['wrestlers', 'divisions', 'companies', 'shows', 'match-config', 'schedule', 'results', 'championships', 'tournaments', 'seasons', 'season-awards', 'events', 'contender-config', 'danger', 'features'];


export default function AdminPanel() {
  const { tab } = useParams<{ tab: string }>();
  const { isAuthenticated, isAdminOrModerator, isSuperAdmin } = useAuth();

  const activeTab: AdminTab = (tab && VALID_TABS.includes(tab as AdminTab)) ? tab as AdminTab : 'wrestlers';

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdminOrModerator) {
    return (
      <div className="admin-panel">
        <div className="access-denied">
          <h2>Admin Access Required</h2>
          <p>You need admin privileges to access this panel.</p>
        </div>
      </div>
    );
  }

  // Moderators cannot access danger zone
  if (activeTab === 'danger' && !isSuperAdmin) {
    return (
      <div className="admin-panel">
        <div className="access-denied">
          <h2>Full Admin Access Required</h2>
          <p>This action requires full Admin privileges.</p>
        </div>
      </div>
    );
  }

  const tabContent: Record<AdminTab, JSX.Element> = {
    features: <ManageFeatures />,
    wrestlers: <ManageWrestlers />,
    divisions: <ManageDivisions />,
    companies: <ManageCompanies />,
    shows: <ManageShows />,
    'match-config': <ManageMatchConfig />,
    schedule: <ScheduleMatch />,
    results: <RecordResult />,
    championships: <ManageChampionships />,
    tournaments: <CreateTournament />,
    seasons: <ManageSeasons />,
    'season-awards': <ManageSeasonAwards />,
    events: (
      <>
        <CreateEvent />
        <MatchCardBuilder />
      </>
    ),
    'contender-config': <AdminContenderConfig />,
    danger: <ClearAllData />,
  };

  return (
    <div className="admin-panel">
      <div className="admin-onboarding-banner">
        <p>
          New to admin workflows? Start with{' '}
          <Link to="/guide/wiki/admin-quickstart">Admin Quickstart</Link> and then review{' '}
          <Link to="/guide/wiki/admin-workflow">Typical Weekly Workflow</Link>.
        </p>
      </div>
      <div className="admin-content">
        {tabContent[activeTab]}
      </div>
    </div>
  );
}
