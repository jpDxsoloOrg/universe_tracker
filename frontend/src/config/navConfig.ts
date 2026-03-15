/**
 * Single source of truth for app navigation: groups and links.
 * Used by both Sidebar (vertical) and TopNav (horizontal).
 * Visibility (feature flags, roles) is applied at render time by consumers.
 */

export type NavItem = {
  path: string;
  i18nKey: string;
  /** When set, link is only shown when this feature is enabled */
  feature?: 'contenders' | 'statistics';
  danger?: boolean;
};

export type NavGroup = {
  key: string;
  i18nKey: string;
  items: NavItem[];
};

/** Public (user) nav: Core & Help */
export const USER_NAV_GROUPS: NavGroup[] = [
  {
    key: 'core',
    i18nKey: 'nav.groups.core',
    items: [
      { path: '/', i18nKey: 'nav.dashboard' },
      { path: '/standings', i18nKey: 'nav.standings' },
      { path: '/activity', i18nKey: 'nav.activity' },
      { path: '/championships', i18nKey: 'nav.championships' },
      { path: '/events', i18nKey: 'nav.events' },
      { path: '/matches', i18nKey: 'nav.matchSearch' },
      { path: '/tournaments', i18nKey: 'nav.tournaments' },
      { path: '/awards', i18nKey: 'nav.seasonAwards' },
      { path: '/contenders', i18nKey: 'nav.contenders', feature: 'contenders' },
      { path: '/stats', i18nKey: 'nav.statistics', feature: 'statistics' },
    ],
  },
];

/** Standalone user links (no subgroup): Help */
export const USER_NAV_STANDALONE: (NavItem & { type: 'link' })[] = [
  {
    type: 'link',
    path: '/guide',
    i18nKey: 'nav.help',
  },
];

/** Admin nav: sub-groups with items */
export const ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    key: 'matchOps',
    i18nKey: 'admin.panel.groups.matchOps',
    items: [
      { path: '/admin/schedule', i18nKey: 'admin.panel.tabs.scheduleMatch' },
      { path: '/admin/results', i18nKey: 'admin.panel.tabs.recordResults' },
      { path: '/admin/events', i18nKey: 'admin.panel.tabs.events' },
      { path: '/admin/match-config', i18nKey: 'admin.panel.tabs.matchConfig' },
    ],
  },
  {
    key: 'leagueSetup',
    i18nKey: 'admin.panel.groups.leagueSetup',
    items: [
      { path: '/admin/players', i18nKey: 'admin.panel.tabs.managePlayers' },
      { path: '/admin/divisions', i18nKey: 'admin.panel.tabs.divisions' },
      { path: '/admin/seasons', i18nKey: 'admin.panel.tabs.seasons' },
      { path: '/admin/season-awards', i18nKey: 'admin.panel.tabs.seasonAwards' },
      { path: '/admin/championships', i18nKey: 'admin.panel.tabs.championships' },
      { path: '/admin/tournaments', i18nKey: 'admin.panel.tabs.tournaments' },
    ],
  },
  {
    key: 'contentSocial',
    i18nKey: 'admin.panel.groups.contentSocial',
    items: [
      { path: '/admin/contender-config', i18nKey: 'admin.panel.tabs.contenderConfig' },
    ],
  },
  {
    key: 'system',
    i18nKey: 'admin.panel.groups.system',
    items: [
      { path: '/admin/features', i18nKey: 'admin.panel.tabs.features' },
      { path: '/admin/danger', i18nKey: 'admin.panel.tabs.dangerZone', danger: true },
    ],
  },
];

/** Path -> group key for user nav (for auto-expand) */
export function getUserGroupForPath(pathname: string): string | null {
  const core = ['/', '/standings', '/activity', '/championships', '/events', '/matches', '/tournaments', '/awards', '/contenders', '/stats'];
  if (core.some((p) => pathname === p) || pathname.startsWith('/events/') || pathname.startsWith('/stats/') || pathname.startsWith('/contenders/')) return 'core';
  return null;
}

/** Path -> admin group key */
export function getAdminGroupForPath(pathname: string): string | null {
  const matchOps = ['/admin/schedule', '/admin/results', '/admin/events', '/admin/match-config'];
  const leagueSetup = ['/admin/players', '/admin/divisions', '/admin/seasons', '/admin/season-awards', '/admin/championships', '/admin/tournaments'];
  const contentSocial = ['/admin/contender-config'];
  const system = ['/admin/features', '/admin/danger'];
  if (matchOps.some((p) => pathname === p)) return 'matchOps';
  if (leagueSetup.some((p) => pathname === p)) return 'leagueSetup';
  if (contentSocial.some((p) => pathname === p)) return 'contentSocial';
  if (system.some((p) => pathname === p)) return 'system';
  return null;
}
