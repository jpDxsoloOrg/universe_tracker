import { APIGatewayProxyHandler } from 'aws-lambda';
import { dynamoDb, TableNames } from '../../lib/dynamodb';
import { success, serverError } from '../../lib/response';

const MIN_MATCHES_FOR_RIVALRY = 3;
const MAX_RIVALRIES_RETURNED = 20;

interface MatchRecord {
  matchId: string;
  date: string;
  participants: string[];
  winners?: string[];
  losers?: string[];
  isChampionship?: boolean;
  status: string;
  seasonId?: string;
}

interface WrestlerRecord {
  wrestlerId: string;
  name: string;
  imageUrl?: string;
}

interface RivalryAgg {
  wrestler1Id: string;
  wrestler2Id: string;
  wrestler1Wins: number;
  wrestler2Wins: number;
  draws: number;
  matchCount: number;
  lastMatchDate: string;
  championshipMatches: number;
  recentMatchIds: string[];
}

function pairKey(id1: string, id2: string): string {
  return [id1, id2].sort().join('|');
}

function intensityBadge(matchCount: number): 'heatingUp' | 'intense' | 'historic' {
  if (matchCount >= 8) return 'historic';
  if (matchCount >= 5) return 'intense';
  return 'heatingUp';
}

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const seasonId = event.queryStringParameters?.seasonId;

    const [wrestlersResult, matchesResult] = await Promise.all([
      dynamoDb.scanAll({ TableName: TableNames.WRESTLERS }),
      dynamoDb.scanAll({ TableName: TableNames.MATCHES }),
    ]);

    const wrestlers = wrestlersResult as unknown as WrestlerRecord[];
    const allMatches = matchesResult as unknown as MatchRecord[];
    let completed = allMatches.filter((m) => m.status === 'completed');
    if (seasonId) {
      completed = completed.filter((m) => m.seasonId === seasonId);
    }

    const wrestlerMap = new Map(wrestlers.map((w) => [w.wrestlerId, w]));

    const aggMap = new Map<string, RivalryAgg>();

    for (const match of completed) {
      const participants = match.participants || [];
      if (participants.length !== 2) continue;
      const [a, b] = participants;
      const key = pairKey(a, b);
      const existing = aggMap.get(key);
      const w1Won = match.winners?.includes(a);
      const w2Won = match.winners?.includes(b);
      const isDraw = !w1Won && !w2Won;

      if (!existing) {
        aggMap.set(key, {
          wrestler1Id: a,
          wrestler2Id: b,
          wrestler1Wins: w1Won ? 1 : 0,
          wrestler2Wins: w2Won ? 1 : 0,
          draws: isDraw ? 1 : 0,
          matchCount: 1,
          lastMatchDate: match.date,
          championshipMatches: match.isChampionship ? 1 : 0,
          recentMatchIds: [match.matchId],
        });
      } else {
        existing.wrestler1Wins += w1Won ? 1 : 0;
        existing.wrestler2Wins += w2Won ? 1 : 0;
        existing.draws += isDraw ? 1 : 0;
        existing.matchCount += 1;
        if (new Date(match.date) > new Date(existing.lastMatchDate)) {
          existing.lastMatchDate = match.date;
        }
        if (match.isChampionship) existing.championshipMatches += 1;
        existing.recentMatchIds.push(match.matchId);
      }
    }

    const rivalries = Array.from(aggMap.values())
      .filter((r) => r.matchCount >= MIN_MATCHES_FOR_RIVALRY)
      .map((r) => {
        const sorted = [...r.recentMatchIds].sort(
          (id1, id2) => {
            const m1 = completed.find((m) => m.matchId === id1);
            const m2 = completed.find((m) => m.matchId === id2);
            const d1 = m1 ? new Date(m1.date).getTime() : 0;
            const d2 = m2 ? new Date(m2.date).getTime() : 0;
            return d2 - d1;
          }
        );
        return {
          ...r,
          recentMatchIds: sorted.slice(0, 5),
        };
      })
      .sort((a, b) => {
        const scoreA = a.matchCount * 2 + (a.championshipMatches > 0 ? 3 : 0) + new Date(a.lastMatchDate).getTime() / 1e12;
        const scoreB = b.matchCount * 2 + (b.championshipMatches > 0 ? 3 : 0) + new Date(b.lastMatchDate).getTime() / 1e12;
        return scoreB - scoreA;
      })
      .slice(0, MAX_RIVALRIES_RETURNED)
      .map((r) => {
        const w1 = wrestlerMap.get(r.wrestler1Id);
        const w2 = wrestlerMap.get(r.wrestler2Id);
        return {
          wrestler1Id: r.wrestler1Id,
          wrestler2Id: r.wrestler2Id,
          wrestler1: w1 ? { wrestlerId: w1.wrestlerId, wrestlerName: w1.name, imageUrl: w1.imageUrl } : undefined,
          wrestler2: w2 ? { wrestlerId: w2.wrestlerId, wrestlerName: w2.name, imageUrl: w2.imageUrl } : undefined,
          wrestler1Wins: r.wrestler1Wins,
          wrestler2Wins: r.wrestler2Wins,
          draws: r.draws,
          matchCount: r.matchCount,
          lastMatchDate: r.lastMatchDate,
          championshipMatches: r.championshipMatches,
          recentMatchIds: r.recentMatchIds,
          intensityBadge: intensityBadge(r.matchCount),
        };
      });

    return success({ rivalries });
  } catch (err) {
    console.error('Error computing rivalries:', err);
    return serverError('Failed to load rivalries');
  }
};
