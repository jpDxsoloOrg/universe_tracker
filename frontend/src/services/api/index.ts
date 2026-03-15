// Shared utilities
export { API_BASE_URL, getAuthToken, fetchWithAuth } from './apiClient';

// API modules
export { wrestlersApi } from './wrestlers.api';
export { matchesApi } from './matches.api';
export { championshipsApi } from './championships.api';
export { tournamentsApi } from './tournaments.api';
export { standingsApi } from './standings.api';
export { dashboardApi } from './dashboard.api';
export { seasonsApi } from './seasons.api';
export { divisionsApi } from './divisions.api';
export { stipulationsApi } from './stipulations.api';
export { matchTypesApi } from './matchTypes.api';
export { eventsApi } from './events.api';
export { contendersApi } from './contenders.api';
export { adminApi } from './admin.api';
export { siteConfigApi } from './siteConfig.api';
export { authApi } from './auth.api';
export { statisticsApi } from './statistics.api';
export { rivalriesApi } from './rivalries.api';
export { imagesApi } from './images.api';
export { activityApi } from './activity.api';
export { seasonAwardsApi } from './seasonAwards.api';
export { companiesApi } from './companies.api';
export { showsApi } from './shows.api';

// Type/interface re-exports
export type { SiteFeatures } from './siteConfig.api';
export type {
  StatsWrestler,
  WrestlerStatsResponse,
  HeadToHeadResponse,
  LeaderboardsResponse,
  RecordsResponse,
  AchievementsResponse,
  RatedMatchSummary,
  MatchRatingsResponse,
  MatchTypeStatsEntry,
  MatchTypeLeaderboardsResponse,
  WrestlerMatchStatsByType,
  WrestlerMatchStatsResponse,
} from './statistics.api';
export type { SeasonAwardsResponse } from './seasonAwards.api';
export type { BulkImportResponse } from './wrestlers.api';
