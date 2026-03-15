import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// --- Hoisted mocks for contexts and child components ---
const { mockUseAuth, mockUseSiteConfig } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockUseSiteConfig: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: mockUseAuth,
}));

vi.mock('../../contexts/SiteConfigContext', () => ({
  SiteConfigProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSiteConfig: mockUseSiteConfig,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../i18n', () => ({}));

// Mock heavy child components to keep tests lightweight
vi.mock('../Sidebar', () => ({ default: () => <nav data-testid="sidebar">Sidebar</nav> }));
vi.mock('../TopBar', () => ({ default: () => <div data-testid="topbar">TopBar</div> }));
vi.mock('../Dashboard', () => ({ default: () => <div data-testid="dashboard">Dashboard</div> }));
vi.mock('../Standings', () => ({ default: () => <div data-testid="standings">Standings</div> }));
vi.mock('../Championships', () => ({ default: () => <div data-testid="championships">Championships</div> }));
vi.mock('../Tournaments', () => ({ default: () => <div data-testid="tournaments">Tournaments</div> }));
vi.mock('../admin/AdminPanel', () => ({ default: () => <div data-testid="admin-panel">AdminPanel</div> }));
vi.mock('../auth/Login', () => ({ default: () => <div data-testid="login">Login</div> }));
vi.mock('../statistics/WrestlerStats', () => ({ default: () => <div data-testid="wrestler-stats">WrestlerStats</div> }));
vi.mock('../statistics/HeadToHeadComparison', () => ({ default: () => <div>H2H</div> }));
vi.mock('../statistics/Leaderboards', () => ({ default: () => <div>Leaderboards</div> }));
vi.mock('../statistics/RecordBook', () => ({ default: () => <div>RecordBook</div> }));
vi.mock('../statistics/TaleOfTheTape', () => ({ default: () => <div>TaleOfTape</div> }));
vi.mock('../statistics/Achievements', () => ({ default: () => <div>Achievements</div> }));
vi.mock('../contenders/ContenderRankings', () => ({ default: () => <div>ContenderRankings</div> }));
vi.mock('../contenders/MyContenderStatus', () => ({ default: () => <div>MyContenderStatus</div> }));
vi.mock('../events/EventsCalendar', () => ({ default: () => <div data-testid="events">Events</div> }));
vi.mock('../events/EventDetail', () => ({ default: () => <div>EventDetail</div> }));
vi.mock('../events/EventResults', () => ({ default: () => <div>EventResults</div> }));
vi.mock('../ErrorBoundary', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Avoid loading WikiArticle (and thus react-syntax-highlighter ESM) in App tests
vi.mock('../Wiki', () => ({ WikiLayout: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('../WikiIndex', () => ({ default: () => <div data-testid="wiki-index">WikiIndex</div> }));
vi.mock('../WikiArticle', () => ({ default: () => <div data-testid="wiki-article">WikiArticle</div> }));

vi.mock('../../App.css', () => ({}));

// We need to override the router in App.tsx to use MemoryRouter.
// Since App uses BrowserRouter internally, we mock react-router-dom
// to swap BrowserRouter with a MemoryRouter we can control.
let testEntries = ['/'];
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    BrowserRouter: ({ children }: { children: React.ReactNode }) => (
      <actual.MemoryRouter initialEntries={testEntries}>{children}</actual.MemoryRouter>
    ),
    Navigate: (props: { to: string; replace?: boolean }) => (
      <div data-testid="navigate" data-to={props.to} />
    ),
  };
});

import App from '../../App';

const ALL_FEATURES = {
  contenders: true,
  statistics: true,
};

function authenticatedAuth(overrides = {}) {
  return {
    isAuthenticated: true,
    isLoading: false,
    isAdminOrModerator: true,
    isSuperAdmin: false,
    isModerator: false,
    groups: ['Admin'],
    email: 'test@example.com',
    signIn: vi.fn(),
    signOut: vi.fn(),
    hasRole: () => true,
    ...overrides,
  };
}

function unauthenticatedAuth() {
  return authenticatedAuth({
    isAuthenticated: false,
    isAdminOrModerator: false,
    isSuperAdmin: false,
    groups: [],
    email: null,
    hasRole: () => false,
  });
}

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testEntries = ['/'];
    mockUseSiteConfig.mockReturnValue({ features: ALL_FEATURES, isLoading: false });
  });

  it('renders with sidebar, topbar, and main content area', () => {
    mockUseAuth.mockReturnValue(authenticatedAuth());
    render(<App />);

    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('topbar')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard')).toBeInTheDocument();
  });

  it('renders public routes without authentication', () => {
    mockUseAuth.mockReturnValue(unauthenticatedAuth());
    testEntries = ['/championships'];
    render(<App />);

    expect(screen.getByTestId('championships')).toBeInTheDocument();
  });

  it('renders /matches as MatchSearch page', async () => {
    mockUseAuth.mockReturnValue(authenticatedAuth());
    testEntries = ['/matches'];
    render(<App />);

    // /matches should render the MatchSearch component, not redirect
    await waitFor(() => {
      expect(screen.queryByTestId('navigate')).not.toBeInTheDocument();
    });
  });

  it('renders /tournaments as Tournaments page', async () => {
    mockUseAuth.mockReturnValue(authenticatedAuth());
    testEntries = ['/tournaments'];
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('tournaments')).toBeInTheDocument();
    });
  });

  it('renders /admin/tournaments as Admin panel route', async () => {
    mockUseAuth.mockReturnValue(authenticatedAuth());
    testEntries = ['/admin/tournaments'];
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('admin-panel')).toBeInTheDocument();
    });
  });

  it('redirects /guide to /guide/wiki', async () => {
    mockUseAuth.mockReturnValue(unauthenticatedAuth());
    testEntries = ['/guide'];
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/guide/wiki');
    });
  });

  it('redirects feature-gated routes to home when feature is disabled', async () => {
    mockUseAuth.mockReturnValue(authenticatedAuth());
    mockUseSiteConfig.mockReturnValue({
      features: { ...ALL_FEATURES, statistics: false },
      isLoading: false,
    });
    testEntries = ['/stats'];
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/');
    });
  });
});
