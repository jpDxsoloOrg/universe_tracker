import { APIGatewayProxyHandler } from 'aws-lambda';
import { dynamoDb, TableNames } from '../../lib/dynamodb';
import { success, serverError } from '../../lib/response';

type FormResult = 'W' | 'L' | 'D';

function getResultForWrestler(
  wrestlerId: string,
  match: { participants?: string[]; winners?: string[]; losers?: string[] }
): FormResult {
  const participants = (match.participants || []) as string[];
  const winners = (match.winners || []) as string[];
  const losers = (match.losers || []) as string[];
  if (!participants.includes(wrestlerId)) return 'D';
  if (winners.includes(wrestlerId)) return 'W';
  if (losers.includes(wrestlerId)) return 'L';
  return 'D';
}

type CompletedMatchForForm = {
  date?: string;
  updatedAt?: string;
  participants?: string[];
  winners?: string[];
  losers?: string[];
};

function computeRecentFormAndStreak(
  wrestlerId: string,
  completedMatches: CompletedMatchForForm[]
): { recentForm: FormResult[]; currentStreak: { type: FormResult; count: number } } {
  const wrestlerMatches = completedMatches
    .filter((m) => ((m.participants || []) as string[]).includes(wrestlerId))
    .sort((a, b) => {
      const aTime = new Date((a.updatedAt ?? 0) as string | number).getTime();
      const bTime = new Date((b.updatedAt ?? 0) as string | number).getTime();
      return bTime - aTime;
    })
    .slice(0, 5);
  const recentForm: FormResult[] = wrestlerMatches.map((m) => getResultForWrestler(wrestlerId, m));
  if (recentForm.length === 0) {
    return { recentForm: [], currentStreak: { type: 'W', count: 0 } };
  }
  const first = recentForm[0];
  let count = 0;
  for (const r of recentForm) {
    if (r !== first) break;
    count++;
  }
  return { recentForm, currentStreak: { type: first, count } };
}

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const seasonId = event.queryStringParameters?.seasonId;

    let completedMatches = await dynamoDb.scanAll({
      TableName: TableNames.MATCHES,
      FilterExpression: '#status = :completed',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':completed': 'completed' },
    });

    // Last 5 and streak: only matches with updatedAt (same as dashboard recent results), sort by updatedAt desc
    completedMatches = completedMatches.filter((m) => m.updatedAt) as typeof completedMatches;

    if (seasonId) {
      // Get season-specific standings with pagination support
      const seasonStandings = await dynamoDb.queryAll({
        TableName: TableNames.SEASON_STANDINGS,
        KeyConditionExpression: 'seasonId = :seasonId',
        ExpressionAttributeValues: { ':seasonId': seasonId },
      });

      // Get all wrestler details with pagination support
      const allWrestlers = await dynamoDb.scanAll({
        TableName: TableNames.WRESTLERS,
      });

      // Build a map of season standings by wrestlerId
      const standingsMap = new Map(
        seasonStandings.map((s) => [s.wrestlerId as string, s])
      );

      // Show ALL wrestlers - those with standings get season W-L-D, others get 0-0-0
      const standings = allWrestlers.map((wrestler) => {
        const standing = standingsMap.get(wrestler.wrestlerId as string);
        const { recentForm, currentStreak } = computeRecentFormAndStreak(
          wrestler.wrestlerId as string,
          completedMatches
        );
        return {
          ...wrestler,
          wins: standing ? ((standing.wins as number) || 0) : 0,
          losses: standing ? ((standing.losses as number) || 0) : 0,
          draws: standing ? ((standing.draws as number) || 0) : 0,
          recentForm,
          currentStreak,
        };
      });

      // Sort by wins descending, then by losses ascending
      standings.sort((a, b) => {
        if (b.wins !== a.wins) {
          return b.wins - a.wins;
        }
        return a.losses - b.losses;
      });

      return success({
        wrestlers: standings,
        seasonId,
        sortedByWins: true,
      });
    }

    // Default: get all-time standings from Wrestlers table with pagination support
    const allWrestlers = await dynamoDb.scanAll({
      TableName: TableNames.WRESTLERS,
    });

    // Sort wrestlers by wins descending, then by losses ascending
    const wrestlers = allWrestlers.sort((a, b) => {
      const aWins = (a.wins as number) || 0;
      const bWins = (b.wins as number) || 0;
      const aLosses = (a.losses as number) || 0;
      const bLosses = (b.losses as number) || 0;

      if (bWins !== aWins) {
        return bWins - aWins;
      }
      return aLosses - bLosses;
    });

    const wrestlersWithForm = wrestlers.map((wrestler) => {
      const { recentForm, currentStreak } = computeRecentFormAndStreak(
        wrestler.wrestlerId as string,
        completedMatches
      );
      return { ...wrestler, recentForm, currentStreak };
    });

    return success({
      wrestlers: wrestlersWithForm,
      sortedByWins: true,
    });
  } catch (err) {
    console.error('Error fetching standings:', err);
    return serverError('Failed to fetch standings');
  }
};
