import { APIGatewayProxyHandler } from 'aws-lambda';
import { dynamoDb, TableNames } from '../../lib/dynamodb';
import { success, notFound, serverError } from '../../lib/response';

interface MatchRecord {
  matchId: string;
  date: string;
  matchFormat?: string;
  matchType?: string;
  participants: string[];
  winners?: string[];
  losers?: string[];
  isChampionship: boolean;
  status: string;
  seasonId?: string;
}

interface WrestlerRecord {
  wrestlerId: string;
  name: string;
}

function getMatchCategory(match: MatchRecord): string {
  const mt = (match.matchFormat || match.matchType || 'singles').toLowerCase();
  if (mt.includes('tag')) return 'tag';
  if (mt.includes('ladder')) return 'ladder';
  if (mt.includes('cage') || mt.includes('cell') || mt.includes('hiac')) return 'cage';
  if (mt.includes('tlc')) return 'tlc';
  if (mt.includes('royal') || mt.includes('rumble')) return 'royalRumble';
  if (mt.includes('table')) return 'tables';
  return 'singles';
}

function computeStatsForType(
  matches: MatchRecord[],
  wrestlerId: string,
): {
  wins: number;
  losses: number;
  draws: number;
  matchesPlayed: number;
  winPercentage: number;
} {
  let wins = 0;
  let losses = 0;
  let draws = 0;

  for (const match of matches) {
    if (match.winners?.includes(wrestlerId)) {
      wins++;
    } else if (match.losers?.includes(wrestlerId)) {
      losses++;
    } else {
      draws++;
    }
  }

  const matchesPlayed = wins + losses + draws;
  const winPercentage = matchesPlayed > 0 ? Math.round((wins / matchesPlayed) * 1000) / 10 : 0;

  return { wins, losses, draws, matchesPlayed, winPercentage };
}

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const wrestlerId = event.pathParameters?.wrestlerId;
    if (!wrestlerId) {
      return notFound('Wrestler ID is required');
    }

    const seasonId = event.queryStringParameters?.seasonId;

    // Verify wrestler exists
    const wrestlerResult = await dynamoDb.get({
      TableName: TableNames.WRESTLERS,
      Key: { wrestlerId },
    });

    if (!wrestlerResult.Item) {
      return notFound('Wrestler not found');
    }

    const wrestler = wrestlerResult.Item as unknown as WrestlerRecord;

    // Get all completed matches
    const allMatches = await dynamoDb.scanAll({
      TableName: TableNames.MATCHES,
      FilterExpression: '#status = :completed',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':completed': 'completed' },
    }) as unknown as MatchRecord[];

    // Filter to wrestler's matches and optionally by season
    let wrestlerMatches = allMatches.filter((m) => m.participants.includes(wrestlerId));
    if (seasonId) {
      wrestlerMatches = wrestlerMatches.filter((m) => m.seasonId === seasonId);
    }

    // Group matches by type
    const matchesByType: Record<string, MatchRecord[]> = {};
    for (const match of wrestlerMatches) {
      const category = getMatchCategory(match);
      if (!matchesByType[category]) matchesByType[category] = [];
      matchesByType[category].push(match);
    }

    // Compute overall stats
    const overall = computeStatsForType(wrestlerMatches, wrestlerId);

    // Compute per-type stats
    const byMatchType: Record<string, ReturnType<typeof computeStatsForType>> = {};
    for (const [matchType, matches] of Object.entries(matchesByType)) {
      byMatchType[matchType] = computeStatsForType(matches, wrestlerId);
    }

    return success({
      wrestlerId: wrestler.wrestlerId,
      wrestlerName: wrestler.name,
      overall,
      byMatchType,
      ...(seasonId ? { seasonId } : {}),
    });
  } catch (err) {
    console.error('Error fetching wrestler statistics:', err);
    return serverError('Failed to fetch wrestler statistics');
  }
};
