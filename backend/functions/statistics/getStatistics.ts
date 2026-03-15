import { APIGatewayProxyHandler } from 'aws-lambda';
import { dynamoDb, TableNames } from '../../lib/dynamodb';
import { success, badRequest, serverError } from '../../lib/response';

interface MatchRecord {
  matchId: string;
  date: string;
  matchFormat?: string;
  matchType?: string; // legacy field name in existing DB records
  stipulationId?: string;
  participants: string[];
  teams?: string[][];
  winners?: string[];
  losers?: string[];
  isChampionship: boolean;
  championshipId?: string;
  status: string;
  seasonId?: string;
  starRating?: number;
  matchOfTheNight?: boolean;
}

interface WrestlerRecord {
  wrestlerId: string;
  name: string;
  wins: number;
  losses: number;
  draws: number;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

interface ChampionshipHistoryRecord {
  championshipId: string;
  champion: string | string[];
  wonDate: string;
  lostDate?: string;
  daysHeld?: number;
  defenses?: number;
}

interface ChampionshipRecord {
  championshipId: string;
  name: string;
  type: string;
  currentChampion?: string | string[];
}

interface MatchTypeRecord {
  matchTypeId: string;
  name: string;
}

interface StipulationRecord {
  stipulationId: string;
  name: string;
}

function normalizeMatchType(value?: string): string {
  const normalized = (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  switch (normalized) {
    case 'singles':
      return 'single';
    case 'fatal4way':
      return 'fatalfourway';
    default:
      return normalized;
  }
}

function categorizeMatch(match: MatchRecord): string {
  // Map match formats to stat types — handle legacy matchType field
  const mt = (match.matchFormat || match.matchType || 'singles').toLowerCase();
  if (mt.includes('tag')) return 'tag';
  return 'singles';
}

function computeStreaks(
  matches: MatchRecord[],
  wrestlerId: string
): { currentWinStreak: number; longestWinStreak: number; longestLossStreak: number } {
  // Sort by date ascending
  const sorted = [...matches].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let currentWinStreak = 0;
  let longestWinStreak = 0;
  let longestLossStreak = 0;
  let tempWinStreak = 0;
  let tempLossStreak = 0;

  for (const match of sorted) {
    const isWin = match.winners?.includes(wrestlerId);
    const isLoss = match.losers?.includes(wrestlerId);

    if (isWin) {
      tempWinStreak++;
      tempLossStreak = 0;
      longestWinStreak = Math.max(longestWinStreak, tempWinStreak);
    } else if (isLoss) {
      tempLossStreak++;
      tempWinStreak = 0;
      longestLossStreak = Math.max(longestLossStreak, tempLossStreak);
    } else {
      // Draw
      tempWinStreak = 0;
      tempLossStreak = 0;
    }
  }

  currentWinStreak = tempWinStreak;

  return { currentWinStreak, longestWinStreak, longestLossStreak };
}

function computeWrestlerStatistics(
  matches: MatchRecord[],
  wrestlerId: string,
  statType: string
): {
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
} {
  let filtered: MatchRecord[];

  if (statType === 'overall') {
    filtered = matches.filter((m) => m.participants.includes(wrestlerId));
  } else {
    filtered = matches.filter(
      (m) => m.participants.includes(wrestlerId) && categorizeMatch(m) === statType
    );
  }

  const completed = filtered.filter((m) => m.status === 'completed');

  let wins = 0;
  let losses = 0;
  let draws = 0;
  let championshipWins = 0;
  let championshipLosses = 0;

  for (const match of completed) {
    const isWin = match.winners?.includes(wrestlerId);
    const isLoss = match.losers?.includes(wrestlerId);

    if (isWin) {
      wins++;
      if (match.isChampionship) championshipWins++;
    } else if (isLoss) {
      losses++;
      if (match.isChampionship) championshipLosses++;
    } else {
      draws++;
    }
  }

  const matchesPlayed = wins + losses + draws;
  const winPercentage = matchesPlayed > 0 ? (wins / matchesPlayed) * 100 : 0;

  const streaks = computeStreaks(completed, wrestlerId);

  const dates = completed
    .map((m) => m.date)
    .sort();

  return {
    wins,
    losses,
    draws,
    matchesPlayed,
    winPercentage: Math.round(winPercentage * 10) / 10,
    ...streaks,
    firstMatchDate: dates[0] || undefined,
    lastMatchDate: dates[dates.length - 1] || undefined,
    championshipWins,
    championshipLosses,
  };
}

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const section = event.queryStringParameters?.section;
    const seasonId = event.queryStringParameters?.seasonId;

    if (!section) {
      return badRequest('Missing required query parameter: section (wrestler-stats, head-to-head, leaderboards, records, championship-stats, achievements, match-ratings)');
    }

    // Load common data
    const [wrestlersResult, matchesResult] = await Promise.all([
      dynamoDb.scanAll({ TableName: TableNames.WRESTLERS }),
      dynamoDb.scanAll({ TableName: TableNames.MATCHES }),
    ]);

    const wrestlers = wrestlersResult as unknown as WrestlerRecord[];
    const allMatches = matchesResult as unknown as MatchRecord[];
    const allCompletedMatches = allMatches.filter((m) => m.status === 'completed');
    const completedMatches = seasonId ? allCompletedMatches.filter((m) => m.seasonId === seasonId) : allCompletedMatches;

    switch (section) {
      case 'wrestler-stats': {
        const wrestlerId = event.queryStringParameters?.wrestlerId;

        // Return wrestler list for dropdowns + stats for specific wrestler
        const wrestlerList = wrestlers.map((p) => ({
          wrestlerId: p.wrestlerId,
          name: p.name,
          wrestlerName: p.name,
        }));

        if (!wrestlerId) {
          return success({ wrestlers: wrestlerList });
        }

        const statTypes = ['overall', 'singles', 'tag', 'ladder', 'cage'] as const;
        const stats = statTypes.map((statType) => ({
          wrestlerId,
          statType,
          ...computeWrestlerStatistics(completedMatches, wrestlerId, statType),
          updatedAt: new Date().toISOString(),
        }));

        // Championship stats for this wrestler
        const champHistoryItems = await dynamoDb.scanAll({
          TableName: TableNames.CHAMPIONSHIP_HISTORY,
        });
        const champHistory = champHistoryItems as unknown as ChampionshipHistoryRecord[];

        const wrestlerChampHistory = champHistory.filter((h) => {
          const champ = h.champion;
          if (Array.isArray(champ)) return champ.includes(wrestlerId);
          return champ === wrestlerId;
        });

        // Group by championship
        const champGroups: Record<string, ChampionshipHistoryRecord[]> = {};
        for (const h of wrestlerChampHistory) {
          if (!champGroups[h.championshipId]) champGroups[h.championshipId] = [];
          champGroups[h.championshipId].push(h);
        }

        const championshipsResult = await dynamoDb.scanAll({
          TableName: TableNames.CHAMPIONSHIPS,
        });
        const championships = championshipsResult as unknown as ChampionshipRecord[];

        const championshipStats = Object.entries(champGroups).map(([champId, reigns]) => {
          const now = new Date();
          const championship = championships.find((c) => c.championshipId === champId);
          const currentChamp = championship?.currentChampion;
          const isCurrentlyHolding = Array.isArray(currentChamp)
            ? currentChamp.includes(wrestlerId)
            : currentChamp === wrestlerId;

          const reignDays = reigns.map((r) => {
            if (r.daysHeld != null) return r.daysHeld;
            const won = new Date(r.wonDate);
            const lost = r.lostDate ? new Date(r.lostDate) : now;
            return Math.floor((lost.getTime() - won.getTime()) / (1000 * 60 * 60 * 24));
          });

          const totalDaysHeld = reignDays.reduce((a, b) => a + b, 0);
          const longestReign = Math.max(...reignDays, 0);
          const shortestReign = reignDays.length > 0 ? Math.min(...reignDays) : 0;
          const totalDefenses = reigns.reduce((sum, r) => sum + (r.defenses || 0), 0);
          const mostDefensesInReign = Math.max(...reigns.map((r) => r.defenses || 0), 0);

          const dates = reigns.map((r) => r.wonDate).sort();

          return {
            wrestlerId,
            championshipId: champId,
            championshipName: championship?.name || champId,
            totalReigns: reigns.length,
            totalDaysHeld,
            longestReign,
            shortestReign,
            totalDefenses,
            mostDefensesInReign,
            firstWonDate: dates[0] || undefined,
            lastWonDate: dates[dates.length - 1] || undefined,
            currentlyHolding: isCurrentlyHolding,
            updatedAt: new Date().toISOString(),
          };
        });

        // Achievements for this wrestler
        const wrestlerAchievements = computeAchievements(
          wrestlerId,
          stats,
          championshipStats,
          completedMatches,
          champHistory,
          championships,
          wrestlers
        );

        return success({
          wrestlers: wrestlerList,
          statistics: stats,
          championshipStats,
          achievements: wrestlerAchievements,
        });
      }

      case 'head-to-head': {
        const wrestler1Id = event.queryStringParameters?.wrestler1Id;
        const wrestler2Id = event.queryStringParameters?.wrestler2Id;

        const wrestlerList = wrestlers.map((p) => ({
          wrestlerId: p.wrestlerId,
          name: p.name,
          wrestlerName: p.name,
        }));

        if (!wrestler1Id || !wrestler2Id) {
          return success({ wrestlers: wrestlerList });
        }

        // Get matches where both wrestlers participated
        const h2hMatches = completedMatches.filter(
          (m) => m.participants.includes(wrestler1Id) && m.participants.includes(wrestler2Id)
        );

        let p1Wins = 0;
        let p2Wins = 0;
        let h2hDraws = 0;
        let championshipMatches = 0;

        for (const match of h2hMatches) {
          if (match.isChampionship) championshipMatches++;
          const p1Won = match.winners?.includes(wrestler1Id);
          const p2Won = match.winners?.includes(wrestler2Id);
          if (p1Won) p1Wins++;
          else if (p2Won) p2Wins++;
          else h2hDraws++;
        }

        // Recent results (last 5)
        const sorted = [...h2hMatches].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        const recentResults = sorted.slice(0, 5).map((m) => ({
          matchId: m.matchId,
          winnerId: m.winners?.[0] || '',
          date: m.date,
        }));

        // Also get overall stats for both wrestlers
        const p1Stats = {
          wrestlerId: wrestler1Id,
          statType: 'overall' as const,
          ...computeWrestlerStatistics(completedMatches, wrestler1Id, 'overall'),
          updatedAt: new Date().toISOString(),
        };

        const p2Stats = {
          wrestlerId: wrestler2Id,
          statType: 'overall' as const,
          ...computeWrestlerStatistics(completedMatches, wrestler2Id, 'overall'),
          updatedAt: new Date().toISOString(),
        };

        const headToHead = h2hMatches.length > 0 ? {
          matchupKey: `${wrestler1Id}-vs-${wrestler2Id}`,
          wrestler1Id,
          wrestler2Id,
          wrestler1Wins: p1Wins,
          wrestler2Wins: p2Wins,
          draws: h2hDraws,
          totalMatches: h2hMatches.length,
          lastMatchDate: sorted[0]?.date,
          lastMatchId: sorted[0]?.matchId,
          championshipMatches,
          recentResults,
          updatedAt: new Date().toISOString(),
        } : null;

        return success({
          wrestlers: wrestlerList,
          headToHead,
          wrestler1Stats: p1Stats,
          wrestler2Stats: p2Stats,
        });
      }

      case 'leaderboards': {
        const wrestlerList = wrestlers.map((p) => ({
          wrestlerId: p.wrestlerId,
          name: p.name,
          wrestlerName: p.name,
        }));

        // Compute overall stats for all wrestlers
        const allWrestlerStats = wrestlers.map((p) => ({
          ...p,
          ...computeWrestlerStatistics(completedMatches, p.wrestlerId, 'overall'),
        }));

        // Championship history for longest reign
        const champHistoryItems = await dynamoDb.scanAll({
          TableName: TableNames.CHAMPIONSHIP_HISTORY,
        });
        const champHistory = champHistoryItems as unknown as ChampionshipHistoryRecord[];

        // Most wins
        const mostWins = [...allWrestlerStats]
          .sort((a, b) => b.wins - a.wins)
          .map((p, i) => ({
            wrestlerId: p.wrestlerId,
            wrestlerName: p.name,
            value: p.wins,
            rank: i + 1,
          }));

        // Best win percentage (min 1 match)
        const bestWinPercentage = [...allWrestlerStats]
          .filter((p) => p.matchesPlayed > 0)
          .sort((a, b) => b.winPercentage - a.winPercentage)
          .map((p, i) => ({
            wrestlerId: p.wrestlerId,
            wrestlerName: p.name,
            value: p.winPercentage,
            rank: i + 1,
          }));

        // Longest streak
        const longestStreak = [...allWrestlerStats]
          .sort((a, b) => b.longestWinStreak - a.longestWinStreak)
          .map((p, i) => ({
            wrestlerId: p.wrestlerId,
            wrestlerName: p.name,
            value: p.longestWinStreak,
            rank: i + 1,
          }));

        // Most championships
        const mostChampionships = [...allWrestlerStats]
          .sort((a, b) => b.championshipWins - a.championshipWins)
          .map((p, i) => ({
            wrestlerId: p.wrestlerId,
            wrestlerName: p.name,
            value: p.championshipWins,
            rank: i + 1,
          }));

        // Longest reign
        const wrestlerLongestReign: { wrestlerId: string; name: string; longestReign: number }[] = wrestlers.map((p) => {
          const reigns = champHistory.filter((h) => {
            const champ = h.champion;
            if (Array.isArray(champ)) return champ.includes(p.wrestlerId);
            return champ === p.wrestlerId;
          });

          const now = new Date();
          const reignDays = reigns.map((r) => {
            if (r.daysHeld != null) return r.daysHeld;
            const won = new Date(r.wonDate);
            const lost = r.lostDate ? new Date(r.lostDate) : now;
            return Math.floor((lost.getTime() - won.getTime()) / (1000 * 60 * 60 * 24));
          });

          return {
            wrestlerId: p.wrestlerId,
            name: p.name,
            longestReign: reignDays.length > 0 ? Math.max(...reignDays) : 0,
          };
        });

        const longestReignLeaderboard = [...wrestlerLongestReign]
          .sort((a, b) => b.longestReign - a.longestReign)
          .map((p, i) => ({
            wrestlerId: p.wrestlerId,
            wrestlerName: p.name,
            value: p.longestReign,
            rank: i + 1,
          }));

        return success({
          wrestlers: wrestlerList,
          leaderboards: {
            mostWins,
            bestWinPercentage,
            longestStreak,
            mostChampionships,
            longestReign: longestReignLeaderboard,
          },
        });
      }

      case 'records': {
        // Compute stats for all wrestlers
        const allWrestlerStats = wrestlers.map((p) => ({
          ...p,
          ...computeWrestlerStatistics(completedMatches, p.wrestlerId, 'overall'),
        }));

        const champHistoryItems = await dynamoDb.scanAll({
          TableName: TableNames.CHAMPIONSHIP_HISTORY,
        });
        const champHistory = champHistoryItems as unknown as ChampionshipHistoryRecord[];

        const now = new Date();

        // Per-match-type stats for all wrestlers
        const matchTypes = ['singles', 'tag', 'ladder', 'cage'] as const;
        const allMatchTypeStats = wrestlers.flatMap((p) =>
          matchTypes.map((mt) => ({
            ...p,
            matchType: mt,
            ...computeWrestlerStatistics(completedMatches, p.wrestlerId, mt),
          }))
        );

        // Overall records
        const mostWinsWrestler = [...allWrestlerStats].sort((a, b) => b.wins - a.wins)[0];
        const highestWinPctWrestler = [...allWrestlerStats].filter((p) => p.matchesPlayed >= 5).sort((a, b) => b.winPercentage - a.winPercentage)[0];
        const mostMatchesWrestler = [...allWrestlerStats].sort((a, b) => b.matchesPlayed - a.matchesPlayed)[0];
        const fewestLossesWrestler = [...allWrestlerStats].filter((p) => p.matchesPlayed >= 10).sort((a, b) => a.losses - b.losses)[0];

        // Championship records
        const allReignDays = champHistory.map((r) => {
          const days = r.daysHeld != null ? r.daysHeld : Math.floor((((r.lostDate ? new Date(r.lostDate) : now).getTime()) - new Date(r.wonDate).getTime()) / (1000 * 60 * 60 * 24));
          return { ...r, days };
        });

        const wrestlerChampWins = wrestlers.map((p) => ({
          ...p,
          champWins: allWrestlerStats.find((s) => s.wrestlerId === p.wrestlerId)?.championshipWins || 0,
        }));
        const mostChampWinsWrestler = [...wrestlerChampWins].sort((a, b) => b.champWins - a.champWins)[0];

        const longestReignRecord = allReignDays.length > 0 ? [...allReignDays].sort((a, b) => b.days - a.days)[0] : undefined;
        const longestReignWrestler = longestReignRecord ? wrestlers.find((p) => {
          const champ = longestReignRecord.champion;
          if (Array.isArray(champ)) return champ.includes(p.wrestlerId);
          return champ === p.wrestlerId;
        }) : undefined;

        const totalDefensesByWrestler = wrestlers.map((p) => {
          const reigns = champHistory.filter((h) => {
            const champ = h.champion;
            if (Array.isArray(champ)) return champ.includes(p.wrestlerId);
            return champ === p.wrestlerId;
          });
          return { ...p, totalDefenses: reigns.reduce((sum, r) => sum + (r.defenses || 0), 0) };
        });
        const mostDefensesWrestler = [...totalDefensesByWrestler].sort((a, b) => b.totalDefenses - a.totalDefenses)[0];

        const mostDefensesInReign = allReignDays.length > 0 ? [...champHistory].sort((a, b) => (b.defenses || 0) - (a.defenses || 0))[0] : undefined;
        const mostDefensesInReignWrestler = mostDefensesInReign ? wrestlers.find((p) => {
          const champ = mostDefensesInReign.champion;
          if (Array.isArray(champ)) return champ.includes(p.wrestlerId);
          return champ === p.wrestlerId;
        }) : undefined;

        // Streak records
        const longestWinStreakWrestler = [...allWrestlerStats].sort((a, b) => b.longestWinStreak - a.longestWinStreak)[0];
        const longestActiveStreakWrestler = [...allWrestlerStats].sort((a, b) => b.currentWinStreak - a.currentWinStreak)[0];
        const longestLossStreakWrestler = [...allWrestlerStats].sort((a, b) => b.longestLossStreak - a.longestLossStreak)[0];

        // Unbeaten streak (wins + draws without a loss) - approximate with win streak for now
        const longestUnbeatenWrestler = longestWinStreakWrestler;

        // Match type records
        const mostSinglesWins = [...allMatchTypeStats].filter((s) => s.matchType === 'singles').sort((a, b) => b.wins - a.wins)[0];
        const mostTagWins = [...allMatchTypeStats].filter((s) => s.matchType === 'tag').sort((a, b) => b.wins - a.wins)[0];
        const bestCageRecord = [...allMatchTypeStats].filter((s) => s.matchType === 'cage' && s.matchesPlayed >= 3).sort((a, b) => b.winPercentage - a.winPercentage)[0];
        const mostLadderWins = [...allMatchTypeStats].filter((s) => s.matchType === 'ladder').sort((a, b) => b.wins - a.wins)[0];

        function makeRecord(name: string, wrestler: WrestlerRecord | undefined, value: number | string, desc: string) {
          return {
            recordName: name,
            holderName: wrestler?.name || 'N/A',
            wrestlerName: wrestler?.name || 'N/A',
            value,
            date: new Date().toISOString().split('T')[0],
            description: desc,
          };
        }

        const records: Record<string, ReturnType<typeof makeRecord>[]> = {
          overall: [
            makeRecord('Most Career Wins', mostWinsWrestler, mostWinsWrestler?.wins || 0, 'All-time leader in total victories across all match types'),
            makeRecord('Highest Win Percentage', highestWinPctWrestler, highestWinPctWrestler ? `${highestWinPctWrestler.winPercentage}%` : '0%', 'Best winning percentage among wrestlers with 5+ matches'),
            makeRecord('Most Matches Played', mostMatchesWrestler, mostMatchesWrestler?.matchesPlayed || 0, 'Total matches competed in across all types'),
            makeRecord('Fewest Losses (10+ matches)', fewestLossesWrestler, fewestLossesWrestler?.losses || 0, 'Fewest losses among wrestlers with 10+ matches played'),
          ],
          championships: [
            makeRecord('Most Championship Wins', mostChampWinsWrestler, mostChampWinsWrestler?.champWins || 0, 'Most championship victories across all titles'),
            makeRecord('Longest Single Reign', longestReignWrestler, longestReignRecord ? `${longestReignRecord.days} days` : '0 days', 'Longest consecutive championship reign'),
            makeRecord('Most Title Defenses', mostDefensesWrestler, mostDefensesWrestler?.totalDefenses || 0, 'Most successful title defenses across all reigns'),
            makeRecord('Most Defenses in Single Reign', mostDefensesInReignWrestler, mostDefensesInReign?.defenses || 0, 'Most title defenses during a single championship reign'),
          ],
          streaks: [
            makeRecord('Longest Win Streak', longestWinStreakWrestler, longestWinStreakWrestler?.longestWinStreak || 0, 'Most consecutive victories without a loss or draw'),
            makeRecord('Longest Active Win Streak', longestActiveStreakWrestler, longestActiveStreakWrestler?.currentWinStreak || 0, 'Current longest active winning streak'),
            makeRecord('Longest Loss Streak', longestLossStreakWrestler, longestLossStreakWrestler?.longestLossStreak || 0, 'Most consecutive losses (a record nobody wants)'),
            makeRecord('Longest Unbeaten Streak', longestUnbeatenWrestler, longestUnbeatenWrestler?.longestWinStreak || 0, 'Most consecutive matches without a loss (wins + draws)'),
          ],
          matchTypes: [
            makeRecord('Most Singles Wins', mostSinglesWins, mostSinglesWins?.wins || 0, 'Most victories in singles competition'),
            makeRecord('Most Tag Team Wins', mostTagWins, mostTagWins?.wins || 0, 'Most victories in tag team matches'),
            makeRecord('Best Cage Match Record', bestCageRecord, bestCageRecord ? `${bestCageRecord.winPercentage}%` : '0%', 'Highest win percentage in cage matches (3+ matches)'),
            makeRecord('Most Ladder Match Wins', mostLadderWins, mostLadderWins?.wins || 0, 'Most victories in ladder matches'),
          ],
        };

        // Active threats - find runner-ups
        const activeThreats: { recordName: string; currentHolder: string; currentValue: number | string; threatWrestler: string; threatValue: number | string; gapDescription: string }[] = [];

        const sortedByWins = [...allWrestlerStats].sort((a, b) => b.wins - a.wins);
        if (sortedByWins.length >= 2) {
          activeThreats.push({
            recordName: 'Most Career Wins',
            currentHolder: sortedByWins[0].name,
            currentValue: sortedByWins[0].wins,
            threatWrestler: sortedByWins[1].name,
            threatValue: sortedByWins[1].wins,
            gapDescription: `${sortedByWins[0].wins - sortedByWins[1].wins} wins behind`,
          });
        }

        if (longestActiveStreakWrestler && longestActiveStreakWrestler.currentWinStreak > 0) {
          activeThreats.push({
            recordName: 'Longest Win Streak',
            currentHolder: longestWinStreakWrestler.name,
            currentValue: longestWinStreakWrestler.longestWinStreak,
            threatWrestler: longestActiveStreakWrestler.name,
            threatValue: `${longestActiveStreakWrestler.currentWinStreak} active`,
            gapDescription: `Currently on a ${longestActiveStreakWrestler.currentWinStreak}-match streak`,
          });
        }

        const sortedByChampWins = [...wrestlerChampWins].sort((a, b) => b.champWins - a.champWins);
        if (sortedByChampWins.length >= 2 && sortedByChampWins[0].champWins > 0) {
          activeThreats.push({
            recordName: 'Most Championship Wins',
            currentHolder: sortedByChampWins[0].name,
            currentValue: sortedByChampWins[0].champWins,
            threatWrestler: sortedByChampWins[1].name,
            threatValue: sortedByChampWins[1].champWins,
            gapDescription: `${sortedByChampWins[0].champWins - sortedByChampWins[1].champWins} title win(s) behind`,
          });
        }

        return success({ records, activeThreats });
      }

      case 'achievements': {
        const wrestlerId = event.queryStringParameters?.wrestlerId;

        const wrestlerList = wrestlers.map((p) => ({
          wrestlerId: p.wrestlerId,
          name: p.name,
          wrestlerName: p.name,
        }));

        if (!wrestlerId) {
          return success({ wrestlers: wrestlerList, allAchievements: getAllAchievementDefinitions() });
        }

        const statTypes = ['overall', 'singles', 'tag', 'ladder', 'cage'] as const;
        const stats = statTypes.map((statType) => ({
          wrestlerId,
          statType,
          ...computeWrestlerStatistics(completedMatches, wrestlerId, statType),
          updatedAt: new Date().toISOString(),
        }));

        const champHistoryItems = await dynamoDb.scanAll({
          TableName: TableNames.CHAMPIONSHIP_HISTORY,
        });
        const champHistory = champHistoryItems as unknown as ChampionshipHistoryRecord[];

        const championshipsResult = await dynamoDb.scanAll({
          TableName: TableNames.CHAMPIONSHIPS,
        });
        const championships = championshipsResult as unknown as ChampionshipRecord[];

        const wrestlerChampHistory = champHistory.filter((h) => {
          const champ = h.champion;
          if (Array.isArray(champ)) return champ.includes(wrestlerId);
          return champ === wrestlerId;
        });

        const champGroups: Record<string, ChampionshipHistoryRecord[]> = {};
        for (const h of wrestlerChampHistory) {
          if (!champGroups[h.championshipId]) champGroups[h.championshipId] = [];
          champGroups[h.championshipId].push(h);
        }

        const now = new Date();
        const championshipStats = Object.entries(champGroups).map(([champId, reigns]) => {
          const championship = championships.find((c) => c.championshipId === champId);
          const currentChamp = championship?.currentChampion;
          const isCurrentlyHolding = Array.isArray(currentChamp)
            ? currentChamp.includes(wrestlerId)
            : currentChamp === wrestlerId;

          const reignDays = reigns.map((r) => {
            if (r.daysHeld != null) return r.daysHeld;
            const won = new Date(r.wonDate);
            const lost = r.lostDate ? new Date(r.lostDate) : now;
            return Math.floor((lost.getTime() - won.getTime()) / (1000 * 60 * 60 * 24));
          });

          return {
            wrestlerId,
            championshipId: champId,
            totalReigns: reigns.length,
            totalDaysHeld: reignDays.reduce((a, b) => a + b, 0),
            longestReign: Math.max(...reignDays, 0),
            shortestReign: reignDays.length > 0 ? Math.min(...reignDays) : 0,
            totalDefenses: reigns.reduce((sum, r) => sum + (r.defenses || 0), 0),
            mostDefensesInReign: Math.max(...reigns.map((r) => r.defenses || 0), 0),
            currentlyHolding: isCurrentlyHolding,
          };
        });

        const wrestlerAchievements = computeAchievements(
          wrestlerId,
          stats,
          championshipStats,
          completedMatches,
          champHistory,
          championships,
          wrestlers
        );

        return success({
          wrestlers: wrestlerList,
          allAchievements: getAllAchievementDefinitions(),
          achievements: wrestlerAchievements,
        });
      }

      case 'match-ratings': {
        const ratedMatches = allCompletedMatches.filter(
          (m): m is MatchRecord & { starRating: number } => typeof (m as MatchRecord).starRating === 'number'
        );
        const sorted = [...ratedMatches].sort(
          (a, b) => (b.starRating ?? 0) - (a.starRating ?? 0)
        );
        const highestRatedMatches = sorted.slice(0, 20).map((m) => ({
          matchId: m.matchId,
          date: m.date,
          starRating: m.starRating,
          matchOfTheNight: m.matchOfTheNight ?? false,
          participants: m.participants,
          winners: m.winners,
          losers: m.losers,
        }));

        const wrestlerRatingSums = new Map<string, { sum: number; count: number }>();
        for (const m of ratedMatches) {
          const rating = m.starRating ?? 0;
          for (const pid of m.participants) {
            const cur = wrestlerRatingSums.get(pid) ?? { sum: 0, count: 0 };
            wrestlerRatingSums.set(pid, { sum: cur.sum + rating, count: cur.count + 1 });
          }
        }
        const wrestlerAverageRatings = Array.from(wrestlerRatingSums.entries()).map(([wrestlerId, { sum, count }]) => ({
          wrestlerId,
          averageRating: Math.round((sum / count) * 10) / 10,
          matchCount: count,
        })).sort((a, b) => b.averageRating - a.averageRating);

        return success({
          highestRatedMatches,
          wrestlerAverageRatings,
        });
      }

      case 'match-types': {
        const selectedMatchTypeId = event.queryStringParameters?.matchTypeId;
        const selectedStipulationId = event.queryStringParameters?.stipulationId;

        const [matchTypesResult, stipulationsResult] = await Promise.all([
          dynamoDb.scanAll({ TableName: TableNames.MATCH_TYPES }),
          dynamoDb.scanAll({ TableName: TableNames.STIPULATIONS }),
        ]);

        const matchTypes = matchTypesResult as unknown as MatchTypeRecord[];
        const stipulations = stipulationsResult as unknown as StipulationRecord[];

        const selectedMatchType = selectedMatchTypeId
          ? matchTypes.find((mt) => mt.matchTypeId === selectedMatchTypeId)
          : undefined;
        if (selectedMatchTypeId && !selectedMatchType) {
          return badRequest(`Unknown matchTypeId: ${selectedMatchTypeId}`);
        }

        const selectedStipulation = selectedStipulationId
          ? stipulations.find((s) => s.stipulationId === selectedStipulationId)
          : undefined;
        if (selectedStipulationId && !selectedStipulation) {
          return badRequest(`Unknown stipulationId: ${selectedStipulationId}`);
        }

        const filteredMatches = completedMatches.filter((match) => {
          if (selectedMatchType) {
            const selectedMatchTypeName = normalizeMatchType(selectedMatchType.name);
            const matchTypeName = normalizeMatchType(match.matchFormat || match.matchType || '');
            if (!matchTypeName || matchTypeName !== selectedMatchTypeName) {
              return false;
            }
          }

          if (selectedStipulationId && match.stipulationId !== selectedStipulationId) {
            return false;
          }

          return true;
        });

        const leaderboard = wrestlers
          .map((p) => {
            const stats = computeWrestlerStatistics(filteredMatches, p.wrestlerId, 'overall');
            return {
              wrestlerId: p.wrestlerId,
              wrestlerName: p.name,
              wins: stats.wins,
              losses: stats.losses,
              draws: stats.draws,
              matchesPlayed: stats.matchesPlayed,
              winPercentage: stats.winPercentage,
            };
          })
          .filter((s) => s.matchesPlayed > 0)
          .sort((a, b) => {
            if (b.winPercentage !== a.winPercentage) return b.winPercentage - a.winPercentage;
            return b.wins - a.wins;
          })
          .map((s, i) => ({ ...s, rank: i + 1 }));

        return success({
          leaderboard,
          appliedFilters: {
            seasonId: seasonId || undefined,
            matchTypeId: selectedMatchTypeId || undefined,
            matchTypeName: selectedMatchType?.name,
            stipulationId: selectedStipulationId || undefined,
            stipulationName: selectedStipulation?.name,
          },
        });
      }

      default:
        return badRequest(`Unknown section: ${section}. Valid sections: wrestler-stats, head-to-head, leaderboards, records, achievements, match-ratings, match-types`);
    }
  } catch (err) {
    console.error('Error computing statistics:', err);
    return serverError('Failed to compute statistics');
  }
};

function getAllAchievementDefinitions() {
  return [
    { achievementId: 'a1', achievementName: 'First Victory', achievementType: 'milestone', description: 'Win your first match', icon: '🏆' },
    { achievementId: 'a2', achievementName: 'Double Digits', achievementType: 'milestone', description: 'Reach 10 wins', icon: '🔟' },
    { achievementId: 'a3', achievementName: 'Half Century', achievementType: 'milestone', description: 'Reach 50 wins', icon: '5️⃣' },
    { achievementId: 'a4', achievementName: 'Century Mark', achievementType: 'milestone', description: 'Play 100 matches', icon: '💯' },
    { achievementId: 'a5', achievementName: 'Iron Man', achievementType: 'milestone', description: 'Play 100 matches', icon: '💯' },
    { achievementId: 'a18', achievementName: 'Best in the World', achievementType: 'milestone', description: 'Achieve a 10+ win streak', icon: '🌍' },
    { achievementId: 'a6', achievementName: 'Unstoppable Force', achievementType: 'record', description: 'Win 15 matches in a row', icon: '🔥' },
    { achievementId: 'a7', achievementName: 'Dominant Champion', achievementType: 'record', description: 'Hold a championship for 180+ days', icon: '👑' },
    { achievementId: 'a8', achievementName: 'Title Collector', achievementType: 'record', description: 'Win championships 9 or more times', icon: '🎖️' },
    { achievementId: 'a9', achievementName: 'Grand Slam', achievementType: 'record', description: 'Hold every championship at least once', icon: '🏅' },
    { achievementId: 'a10', achievementName: 'The Workhorse', achievementType: 'record', description: 'Compete in every event for a full season', icon: '🐴' },
    { achievementId: 'a11', achievementName: 'Main Eventer', achievementType: 'special', description: 'Win 5 championship matches in a row', icon: '⭐' },
    { achievementId: 'a12', achievementName: 'Cage Master', achievementType: 'special', description: 'Win 5+ cage matches', icon: '🔒' },
    { achievementId: 'a13', achievementName: 'Deadman Walking', achievementType: 'special', description: 'Win a match after losing 4 in a row', icon: '💀' },
    { achievementId: 'a14', achievementName: 'Never Give Up', achievementType: 'special', description: 'Come back from a 0-5 head-to-head deficit to tie the series', icon: '💪' },
    { achievementId: 'a15', achievementName: 'Peoples Champion', achievementType: 'special', description: 'Win 3 different championships', icon: '🎤' },
    { achievementId: 'a16', achievementName: 'The Game', achievementType: 'special', description: 'Win a championship match via submission in a cage', icon: '🎮' },
    { achievementId: 'a17', achievementName: 'Showstopper', achievementType: 'special', description: 'Win 3 ladder matches in a row', icon: '🌟' },
  ];
}

function computeAchievements(
  wrestlerId: string,
  stats: { statType: string; wins: number; matchesPlayed: number; longestWinStreak: number; longestLossStreak: number; championshipWins: number }[],
  championshipStats: { championshipId: string; totalReigns: number; longestReign: number; totalDaysHeld: number }[],
  completedMatches: MatchRecord[],
  allChampHistory: ChampionshipHistoryRecord[],
  allChampionships: ChampionshipRecord[],
  _wrestlers: WrestlerRecord[]
) {
  const earned: { wrestlerId: string; achievementId: string; achievementName: string; achievementType: string; description: string; earnedAt: string; icon: string; metadata?: Record<string, unknown> }[] = [];
  const overall = stats.find((s) => s.statType === 'overall');
  const cageStats = stats.find((s) => s.statType === 'cage');
  const now = new Date().toISOString().split('T')[0];

  if (!overall) return earned;

  // a1: First Victory - win >= 1
  if (overall.wins >= 1) {
    earned.push({ wrestlerId, achievementId: 'a1', achievementName: 'First Victory', achievementType: 'milestone', description: 'Win your first match', earnedAt: now, icon: '🏆' });
  }

  // a2: Double Digits - 10 wins
  if (overall.wins >= 10) {
    earned.push({ wrestlerId, achievementId: 'a2', achievementName: 'Double Digits', achievementType: 'milestone', description: 'Reach 10 wins', earnedAt: now, icon: '🔟' });
  }

  // a3: Half Century - 50 wins
  if (overall.wins >= 50) {
    earned.push({ wrestlerId, achievementId: 'a3', achievementName: 'Half Century', achievementType: 'milestone', description: 'Reach 50 wins', earnedAt: now, icon: '5️⃣' });
  }

  // a4/a5: Century Mark / Iron Man - 100 matches
  if (overall.matchesPlayed >= 100) {
    earned.push({ wrestlerId, achievementId: 'a4', achievementName: 'Century Mark', achievementType: 'milestone', description: 'Play 100 matches', earnedAt: now, icon: '💯' });
    earned.push({ wrestlerId, achievementId: 'a5', achievementName: 'Iron Man', achievementType: 'milestone', description: 'Play 100 matches', earnedAt: now, icon: '💯' });
  }

  // a18: Best in the World - 10+ win streak
  if (overall.longestWinStreak >= 10) {
    earned.push({ wrestlerId, achievementId: 'a18', achievementName: 'Best in the World', achievementType: 'milestone', description: 'Achieve a 10+ win streak', earnedAt: now, icon: '🌍', metadata: { streakLength: overall.longestWinStreak } });
  }

  // a6: Unstoppable Force - 15 match win streak
  if (overall.longestWinStreak >= 15) {
    earned.push({ wrestlerId, achievementId: 'a6', achievementName: 'Unstoppable Force', achievementType: 'record', description: 'Win 15 matches in a row', earnedAt: now, icon: '🔥' });
  }

  // a7: Dominant Champion - 180+ day reign
  const hasLongReign = championshipStats.some((cs) => cs.longestReign >= 180);
  if (hasLongReign) {
    earned.push({ wrestlerId, achievementId: 'a7', achievementName: 'Dominant Champion', achievementType: 'record', description: 'Hold a championship for 180+ days', earnedAt: now, icon: '👑' });
  }

  // a8: Title Collector - 9+ championship wins
  if (overall.championshipWins >= 9) {
    earned.push({ wrestlerId, achievementId: 'a8', achievementName: 'Title Collector', achievementType: 'record', description: 'Win championships 9 or more times', earnedAt: now, icon: '🎖️' });
  }

  // a9: Grand Slam - hold every championship at least once
  const activeChampionships = allChampionships.filter((c) => {
    const ch = c as ChampionshipRecord & { isActive?: boolean };
    return ch.isActive !== false;
  });
  if (activeChampionships.length > 0) {
    const heldChampionships = new Set(championshipStats.filter((cs) => cs.totalReigns > 0).map((cs) => cs.championshipId));
    const hasAll = activeChampionships.every((c) => heldChampionships.has(c.championshipId));
    if (hasAll) {
      earned.push({ wrestlerId, achievementId: 'a9', achievementName: 'Grand Slam', achievementType: 'record', description: 'Hold every championship at least once', earnedAt: now, icon: '🏅' });
    }
  }

  // a12: Cage Master - 5+ cage match wins
  if (cageStats && cageStats.wins >= 5) {
    earned.push({ wrestlerId, achievementId: 'a12', achievementName: 'Cage Master', achievementType: 'special', description: 'Win 5+ cage matches', earnedAt: now, icon: '🔒' });
  }

  // a13: Deadman Walking - win after losing 4 in a row
  if (overall.longestLossStreak >= 4 && overall.wins > 0) {
    // Check if there's a win after a 4+ loss streak
    const wrestlerMatches = completedMatches
      .filter((m) => m.participants.includes(wrestlerId))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let lossStreak = 0;
    let hadComebackAfterFour = false;
    for (const m of wrestlerMatches) {
      if (m.losers?.includes(wrestlerId)) {
        lossStreak++;
      } else if (m.winners?.includes(wrestlerId)) {
        if (lossStreak >= 4) hadComebackAfterFour = true;
        lossStreak = 0;
      } else {
        lossStreak = 0;
      }
    }
    if (hadComebackAfterFour) {
      earned.push({ wrestlerId, achievementId: 'a13', achievementName: 'Deadman Walking', achievementType: 'special', description: 'Win a match after losing 4 in a row', earnedAt: now, icon: '💀' });
    }
  }

  // a15: Peoples Champion - hold 3 different championships
  const uniqueChampionships = new Set(
    allChampHistory
      .filter((h) => {
        const champ = h.champion;
        if (Array.isArray(champ)) return champ.includes(wrestlerId);
        return champ === wrestlerId;
      })
      .map((h) => h.championshipId)
  );
  if (uniqueChampionships.size >= 3) {
    earned.push({ wrestlerId, achievementId: 'a15', achievementName: 'Peoples Champion', achievementType: 'special', description: 'Win 3 different championships', earnedAt: now, icon: '🎤' });
  }

  return earned;
}
