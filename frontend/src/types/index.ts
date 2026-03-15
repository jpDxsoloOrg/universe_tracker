export interface Wrestler {
  wrestlerId: string;
  name: string;
  nickname?: string;
  finisher?: string;
  weight?: string;
  height?: string;
  hometown?: string;
  alignment?: 'face' | 'heel' | 'tweener';
  wins: number;
  losses: number;
  draws: number;
  imageUrl?: string;
  divisionId?: string;
  companyId?: string;
  createdAt: string;
  updatedAt: string;
  /** Last 5 match results (newest first): W win, L loss, D draw */
  recentForm?: ('W' | 'L' | 'D')[];
  /** Current consecutive result streak from most recent match */
  currentStreak?: { type: 'W' | 'L' | 'D'; count: number };
}

export interface Match {
  matchId: string;
  date: string;
  matchFormat: string; // "singles", "tag", "triple-threat", etc.
  stipulationId?: string; // References Stipulations table
  participants: string[]; // wrestlerIds
  teams?: string[][]; // Array of teams, each team is an array of wrestlerIds (for tag team matches)
  winners?: string[]; // wrestlerIds
  losers?: string[]; // wrestlerIds
  winningTeam?: number; // Index of winning team (for tag team matches)
  isChampionship: boolean;
  isTitleDefense?: boolean;
  championshipId?: string;
  tournamentId?: string;
  seasonId?: string;
  status: 'scheduled' | 'completed';
  createdAt: string;
  starRating?: number;
  matchOfTheNight?: boolean;
}

// Input type for scheduling a new match (uses new field names, backend handles legacy fields)
export interface ScheduleMatchInput {
  date?: string;
  matchFormat: string;
  stipulationId?: string;
  participants: string[];
  teams?: string[][];
  isChampionship: boolean;
  championshipId?: string;
  tournamentId?: string;
  seasonId?: string;
  eventId?: string;
  designation?: string;
  status: 'scheduled';
}

export interface Championship {
  championshipId: string;
  name: string;
  type: 'singles' | 'tag';
  currentChampion?: string | string[]; // wrestlerId or array for tag teams
  divisionId?: string;
  companyId?: string;
  imageUrl?: string;
  createdAt: string;
  isActive: boolean;
}

export interface ChampionshipReign {
  championshipId: string;
  champion: string | string[];
  wonDate: string;
  lostDate?: string;
  matchId: string;
  daysHeld?: number;
  defenses?: number;
}

export interface Tournament {
  tournamentId: string;
  name: string;
  type: 'single-elimination' | 'round-robin';
  status: 'upcoming' | 'in-progress' | 'completed';
  participants: string[]; // wrestlerIds
  brackets?: TournamentBracket; // for single-elimination
  standings?: Record<string, Omit<RoundRobinStanding, 'wrestlerId'>>; // for round-robin
  winner?: string;
  createdAt: string;
}

export interface TournamentBracket {
  rounds: BracketRound[];
}

export interface BracketRound {
  roundNumber: number;
  matches: BracketMatch[];
}

export interface BracketMatch {
  matchId?: string;
  participant1?: string;
  participant2?: string;
  winner?: string;
}

export interface RoundRobinStanding {
  wrestlerId: string;
  wins: number;
  losses: number;
  draws: number;
  points: number; // 2 for win, 1 for draw
}

export interface Standings {
  wrestlers: Wrestler[];
  seasonId?: string;
  sortedByWins: boolean;
}

/** Dashboard API response types */
export interface DashboardChampion {
  championshipId: string;
  championshipName: string;
  championName: string;
  championImageUrl?: string;
  wrestlerId: string;
  wonDate?: string;
  defenses?: number;
}

export interface DashboardEvent {
  eventId: string;
  name: string;
  date: string;
  eventType: string;
  venue?: string;
  matchCount?: number;
}

export interface DashboardMatch {
  matchId: string;
  date: string;
  matchType: string;
  stipulation?: string;
  isChampionship?: boolean;
  championshipName?: string;
  championshipImageUrl?: string;
  starRating?: number;
  matchOfTheNight?: boolean;
  winnerName: string;
  winnerImageUrl?: string;
  loserName: string;
  loserImageUrl?: string;
  eventId?: string;
}

export interface DashboardSeason {
  seasonId: string;
  name: string;
  startDate?: string;
  endDate?: string;
  status: string;
  matchesPlayed?: number;
}

export interface DashboardQuickStats {
  totalWrestlers: number;
  totalMatches: number;
  activeChampionships: number;
  mostWinsWrestler?: { name: string; wins: number };
}

export interface DashboardData {
  currentChampions: DashboardChampion[];
  upcomingEvents: DashboardEvent[];
  recentResults: DashboardMatch[];
  seasonInfo: DashboardSeason | null;
  quickStats: DashboardQuickStats;
}

export interface Season {
  seasonId: string;
  name: string;
  startDate: string;
  endDate?: string;
  status: 'active' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export interface Division {
  divisionId: string;
  name: string;
  description?: string;
  companyId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Company {
  companyId: string;
  name: string;
  abbreviation?: string;
  imageUrl?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Show {
  showId: string;
  name: string;
  companyId: string;
  description?: string;
  schedule?: 'weekly' | 'ppv' | 'special';
  createdAt: string;
  updatedAt: string;
}

export interface Stipulation {
  stipulationId: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MatchType {
  matchTypeId: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export type SeasonAwardType = 'mvp' | 'longest_win_streak' | 'iron_man' | 'best_win_pct' | 'most_title_defenses' | 'custom';

export interface SeasonAward {
  awardId: string;
  seasonId: string;
  name: string;
  awardType: SeasonAwardType;
  wrestlerId: string;
  wrestlerName?: string;
  description?: string;
  value?: string;
  createdAt: string;
}

export interface MatchFilters {
  status?: string;
  wrestlerId?: string;
  matchType?: string;
  stipulationId?: string;
  championshipId?: string;
  seasonId?: string;
  dateFrom?: string;
  dateTo?: string;
}

/** Activity feed item from GET /activity */
export type ActivityItemType =
  | 'match_result'
  | 'championship_change'
  | 'season_event'
  | 'tournament_result';

export interface ActivityItem {
  id: string;
  type: ActivityItemType;
  timestamp: string;
  summary: string;
  metadata: Record<string, unknown>;
}

export interface ActivityFeedResponse {
  items: ActivityItem[];
  nextCursor: string | null;
}
