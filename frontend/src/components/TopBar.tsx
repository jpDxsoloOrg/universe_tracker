import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useNavLayout } from '../contexts/navLayoutContext';
import './TopBar.css';

export default function TopBar() {
  const { t } = useTranslation();
  const location = useLocation();
  const { mode, setMode } = useNavLayout();

  const getPageInfo = (): { title: string; parent?: string } => {
    const path = location.pathname;

    // Admin routes with breadcrumbs
    if (path.startsWith('/admin')) {
      const tab = path.split('/')[2];
      if (!tab) return { title: t('admin.panel.title') };

      const adminTabMap: Record<string, string> = {
        schedule: t('admin.panel.tabs.scheduleMatch'),
        results: t('admin.panel.tabs.recordResults'),
        events: t('admin.panel.tabs.events'),
        'match-config': t('admin.panel.tabs.matchConfig'),
        seasons: t('admin.panel.tabs.seasons'),
        'season-awards': t('admin.panel.tabs.seasonAwards'),
        players: t('admin.panel.tabs.managePlayers'),
        divisions: t('admin.panel.tabs.divisions'),
        championships: t('admin.panel.tabs.championships'),
        tournaments: t('admin.panel.tabs.tournaments'),
        'contender-config': t('admin.panel.tabs.contenderConfig'),
        features: t('admin.panel.tabs.features'),
        danger: t('admin.panel.tabs.dangerZone'),
      };

      const tabToGroup: Record<string, string> = {
        schedule: t('admin.panel.groups.matchOps'),
        results: t('admin.panel.groups.matchOps'),
        events: t('admin.panel.groups.matchOps'),
        'match-config': t('admin.panel.groups.matchOps'),
        players: t('admin.panel.groups.leagueSetup'),
        divisions: t('admin.panel.groups.leagueSetup'),
        seasons: t('admin.panel.groups.leagueSetup'),
        'season-awards': t('admin.panel.groups.leagueSetup'),
        championships: t('admin.panel.groups.leagueSetup'),
        tournaments: t('admin.panel.groups.leagueSetup'),
        'contender-config': t('admin.panel.groups.contentSocial'),
        features: t('admin.panel.groups.system'),
        danger: t('admin.panel.groups.system'),
      };

      const groupName = tabToGroup[tab];
      return {
        title: adminTabMap[tab] || t('admin.panel.title'),
        parent: groupName ? `${t('nav.admin')} / ${groupName}` : t('nav.admin'),
      };
    }

    // Events sub-routes
    if (path.match(/^\/events\/[^/]+\/results/)) {
      return { title: t('events.results.title'), parent: t('nav.events') };
    }
    if (path.match(/^\/events\/[^/]+/)) {
      return { title: t('events.detail.matchCard'), parent: t('nav.events') };
    }

    // Contender sub-routes
    if (path === '/contenders/my-status') {
      return { title: t('contenders.myStatus.title'), parent: t('nav.contenders') };
    }

    // Stats sub-routes
    if (path.startsWith('/stats/')) {
      const segment = path.split('/')[2] ?? '';
      const statsMap: Record<string, string> = {
        player: t('statistics.playerStats.title'),
        'head-to-head': t('statistics.headToHead.title'),
        leaderboards: t('statistics.leaderboards.title'),
        records: t('statistics.recordBook.title'),
        'tale-of-tape': t('statistics.taleOfTape.title'),
        achievements: t('statistics.achievements.title'),
      };
      return {
        title: statsMap[segment] || t('nav.statistics'),
        parent: t('nav.statistics'),
      };
    }

    // Top-level routes
    const topLevelMap: Record<string, string> = {
      '/': t('nav.dashboard'),
      '/standings': t('nav.standings'),
      '/championships': t('nav.championships'),
      '/tournaments': t('nav.tournaments'),
      '/awards': t('nav.seasonAwards'),
      '/events': t('nav.events'),
      '/matches': t('nav.matchSearch'),
      '/contenders': t('nav.contenders'),
      '/stats': t('statistics.playerStats.title'),
      '/guide': t('nav.help'),
    };

    return { title: topLevelMap[path] || 'Page' };
  };

  const { title, parent } = getPageInfo();

  return (
    <div className="top-bar">
      {parent ? (
        <div className="top-bar-breadcrumb">
          <span className="top-bar-parent">{parent}</span>
          <span className="top-bar-separator">/</span>
          <span className="top-bar-title">{title}</span>
        </div>
      ) : (
        <span className="top-bar-title">{title}</span>
      )}
      {mode === 'sidebar' && (
        <button
          type="button"
          className="top-bar-layout-toggle"
          onClick={() => setMode('topnav')}
          aria-label="Switch to top menu"
          title={t('nav.switchToTopMenu')}
        >
          {t('nav.switchToTopMenu')}
        </button>
      )}
    </div>
  );
}
