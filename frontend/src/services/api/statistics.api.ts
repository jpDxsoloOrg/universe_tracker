import type {
  WrestlerStatistics,
  HeadToHead,
  ChampionshipStats,
  Achievement,
  LeaderboardEntry,
  RecordEntry,
} from '../../types/statistics';
import { API_BASE_URL, fetchWithAuth } from './apiClient';

export interface StatsWrestler {
  wrestlerId: string;
  name: string;
  wrestlerName: string;
}

export interface WrestlerStatsResponse {
  wrestlers: StatsWrestler[];
  statistics?: WrestlerStatistics[];
  championshipStats?: (ChampionshipStats & { championshipName?: string })[];
  achievements?: Achievement[];
}

export interface HeadToHeadResponse {
  wrestlers: StatsWrestler[];
  headToHead: HeadToHead | null;
  wrestler1Stats: WrestlerStatistics;
  wrestler2Stats: WrestlerStatistics;
}

export interface LeaderboardsResponse {
  wrestlers: StatsWrestler[];
  leaderboards: Record<string, LeaderboardEntry[]>;
}

export interface RecordsResponse {
  records: Record<string, RecordEntry[]>;
  activeThreats: {
    recordName: string;
    currentHolder: string;
    currentValue: number | string;
    threatWrestler: string;
    threatValue: number | string;
    gapDescription: string;
  }[];
}

export interface AchievementsResponse {
  wrestlers: StatsWrestler[];
  allAchievements: Omit<Achievement, 'wrestlerId' | 'earnedAt'>[];
  achievements?: Achievement[];
}

export interface RatedMatchSummary {
  matchId: string;
  date: string;
  starRating: number;
  matchOfTheNight: boolean;
  participants: string[];
  winners?: string[];
  losers?: string[];
}

export interface WrestlerAverageRating {
  wrestlerId: string;
  averageRating: number;
  matchCount: number;
}

export interface MatchRatingsResponse {
  highestRatedMatches: RatedMatchSummary[];
  wrestlerAverageRatings: WrestlerAverageRating[];
}

export interface MatchTypeStatsEntry {
  wrestlerId: string;
  wrestlerName: string;
  wins: number;
  losses: number;
  draws: number;
  matchesPlayed: number;
  winPercentage: number;
  rank: number;
}

export interface MatchTypeLeaderboardsResponse {
  leaderboard: MatchTypeStatsEntry[];
  appliedFilters?: {
    seasonId?: string;
    matchTypeId?: string;
    matchTypeName?: string;
    stipulationId?: string;
    stipulationName?: string;
  };
}

export interface WrestlerMatchStatsByType {
  wins: number;
  losses: number;
  draws: number;
  matchesPlayed: number;
  winPercentage: number;
}

export interface WrestlerMatchStatsResponse {
  wrestlerId: string;
  wrestlerName: string;
  overall: WrestlerMatchStatsByType;
  byMatchType: Record<string, WrestlerMatchStatsByType>;
  seasonId?: string;
}

export const statisticsApi = {
  getWrestlerStats: async (wrestlerId?: string, seasonId?: string, signal?: AbortSignal): Promise<WrestlerStatsResponse> => {
    const params = new URLSearchParams({ section: 'player-stats' });
    if (wrestlerId) params.set('playerId', wrestlerId);
    if (seasonId) params.set('seasonId', seasonId);
    return fetchWithAuth(`${API_BASE_URL}/statistics?${params}`, {}, signal);
  },

  getHeadToHead: async (wrestler1Id: string, wrestler2Id: string, seasonId?: string, signal?: AbortSignal): Promise<HeadToHeadResponse> => {
    const params = new URLSearchParams({ section: 'head-to-head', player1Id: wrestler1Id, player2Id: wrestler2Id });
    if (seasonId) params.set('seasonId', seasonId);
    return fetchWithAuth(`${API_BASE_URL}/statistics?${params}`, {}, signal);
  },

  getHeadToHeadWrestlers: async (signal?: AbortSignal): Promise<{ wrestlers: StatsWrestler[] }> => {
    const params = new URLSearchParams({ section: 'head-to-head' });
    return fetchWithAuth(`${API_BASE_URL}/statistics?${params}`, {}, signal);
  },

  getLeaderboards: async (seasonId?: string, signal?: AbortSignal): Promise<LeaderboardsResponse> => {
    const params = new URLSearchParams({ section: 'leaderboards' });
    if (seasonId) params.set('seasonId', seasonId);
    return fetchWithAuth(`${API_BASE_URL}/statistics?${params}`, {}, signal);
  },

  getRecords: async (signal?: AbortSignal): Promise<RecordsResponse> => {
    const params = new URLSearchParams({ section: 'records' });
    return fetchWithAuth(`${API_BASE_URL}/statistics?${params}`, {}, signal);
  },

  getAchievements: async (wrestlerId?: string, signal?: AbortSignal): Promise<AchievementsResponse> => {
    const params = new URLSearchParams({ section: 'achievements' });
    if (wrestlerId) params.set('playerId', wrestlerId);
    return fetchWithAuth(`${API_BASE_URL}/statistics?${params}`, {}, signal);
  },

  getMatchRatings: async (signal?: AbortSignal): Promise<MatchRatingsResponse> => {
    const params = new URLSearchParams({ section: 'match-ratings' });
    return fetchWithAuth(`${API_BASE_URL}/statistics?${params}`, {}, signal);
  },

  getMatchTypeLeaderboards: async (
    filters?: { seasonId?: string; matchTypeId?: string; stipulationId?: string },
    signal?: AbortSignal
  ): Promise<MatchTypeLeaderboardsResponse> => {
    const params = new URLSearchParams({ section: 'match-types' });
    if (filters?.seasonId) params.set('seasonId', filters.seasonId);
    if (filters?.matchTypeId) params.set('matchTypeId', filters.matchTypeId);
    if (filters?.stipulationId) params.set('stipulationId', filters.stipulationId);
    return fetchWithAuth(`${API_BASE_URL}/statistics?${params}`, {}, signal);
  },

  getWrestlerMatchStats: async (wrestlerId: string, seasonId?: string, signal?: AbortSignal): Promise<WrestlerMatchStatsResponse> => {
    const params = new URLSearchParams();
    if (seasonId) params.set('seasonId', seasonId);
    const qs = params.toString();
    return fetchWithAuth(`${API_BASE_URL}/wrestlers/${wrestlerId}/statistics${qs ? `?${qs}` : ''}`, {}, signal);
  },
};
