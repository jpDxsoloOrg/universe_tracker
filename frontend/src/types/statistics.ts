export interface WrestlerStatistics {
  wrestlerId: string;
  statType: 'overall' | 'singles' | 'tag' | 'ladder' | 'cage';
  wins: number;
  losses: number;
  draws: number;
  matchesPlayed: number;
  winPercentage: number;
  currentWinStreak: number;
  longestWinStreak: number;
  longestLossStreak: number;
  firstMatchDate?: string;
  lastMatchDate?: string;
  championshipWins: number;
  championshipLosses: number;
  updatedAt: string;
}

export interface HeadToHead {
  matchupKey: string;
  wrestler1Id: string;
  wrestler2Id: string;
  wrestler1Wins: number;
  wrestler2Wins: number;
  draws: number;
  totalMatches: number;
  lastMatchDate?: string;
  lastMatchId?: string;
  championshipMatches: number;
  recentResults: {
    matchId: string;
    winnerId: string;
    date: string;
  }[];
  updatedAt: string;
}

export interface ChampionshipStats {
  wrestlerId: string;
  championshipId: string;
  totalReigns: number;
  totalDaysHeld: number;
  longestReign: number;
  shortestReign: number;
  totalDefenses: number;
  mostDefensesInReign: number;
  firstWonDate?: string;
  lastWonDate?: string;
  currentlyHolding: boolean;
  updatedAt: string;
}

export interface Achievement {
  wrestlerId: string;
  achievementId: string;
  achievementName: string;
  achievementType: 'milestone' | 'record' | 'special';
  description: string;
  earnedAt: string;
  metadata?: Record<string, unknown>;
  icon: string;
}

export interface LeaderboardEntry {
  wrestlerId: string;
  wrestlerName: string;
  value: number;
  rank: number;
}

export interface RecordEntry {
  recordName: string;
  holderName: string;
  wrestlerName: string;
  value: number | string;
  date: string;
  description: string;
}
