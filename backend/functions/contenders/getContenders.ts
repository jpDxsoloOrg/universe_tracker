import { APIGatewayProxyHandler } from 'aws-lambda';
import { dynamoDb, TableNames } from '../../lib/dynamodb';
import { success, badRequest, notFound, serverError } from '../../lib/response';

interface ContenderRanking {
  championshipId: string;
  wrestlerId: string;
  rank: number;
  rankingScore: number;
  winPercentage: number;
  currentStreak: number;
  matchesInPeriod: number;
  winsInPeriod: number;
  previousRank?: number | null;
  calculatedAt: string;
}

interface Wrestler {
  wrestlerId: string;
  name: string;
  imageUrl?: string;
}

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const championshipId = event.pathParameters?.championshipId;

    if (!championshipId) {
      return badRequest('Championship ID is required');
    }

    // ------------------------------------------------------------------
    // 1. Validate the championship exists
    // ------------------------------------------------------------------
    const championshipResult = await dynamoDb.get({
      TableName: TableNames.CHAMPIONSHIPS,
      Key: { championshipId },
    });

    if (!championshipResult.Item) {
      return notFound('Championship not found');
    }

    const championship = championshipResult.Item;

    // ------------------------------------------------------------------
    // 2. Query contender rankings using the RankIndex GSI
    // ------------------------------------------------------------------
    const rankingsResult = await dynamoDb.queryAll({
      TableName: TableNames.CONTENDER_RANKINGS,
      IndexName: 'RankIndex',
      KeyConditionExpression: 'championshipId = :cid',
      ExpressionAttributeValues: { ':cid': championshipId },
      ScanIndexForward: true, // ascending by rank
    });

    const rankings = rankingsResult as unknown as ContenderRanking[];

    // ------------------------------------------------------------------
    // 3. Collect all wrestler IDs to fetch (contenders + current champion)
    // ------------------------------------------------------------------
    const wrestlerIds = new Set<string>();
    for (const ranking of rankings) {
      wrestlerIds.add(ranking.wrestlerId);
    }

    const currentChampion = championship.currentChampion as string | string[] | undefined;
    if (currentChampion) {
      if (Array.isArray(currentChampion)) {
        currentChampion.forEach((id) => wrestlerIds.add(id));
      } else {
        wrestlerIds.add(currentChampion);
      }
    }

    // ------------------------------------------------------------------
    // 4. Fetch all required wrestler records
    // ------------------------------------------------------------------
    const wrestlersMap = new Map<string, Wrestler>();

    for (const wrestlerId of wrestlerIds) {
      const wrestlerResult = await dynamoDb.get({
        TableName: TableNames.WRESTLERS,
        Key: { wrestlerId },
      });

      if (wrestlerResult.Item) {
        const wrestler = wrestlerResult.Item as unknown as Wrestler;
        wrestlersMap.set(wrestlerId, wrestler);
      }
    }

    // ------------------------------------------------------------------
    // 5. Build the current champion object
    // ------------------------------------------------------------------
    let currentChampionData: Record<string, unknown> | null = null;

    if (currentChampion) {
      const championId = Array.isArray(currentChampion) ? currentChampion[0] : currentChampion;
      const championWrestler = wrestlersMap.get(championId);

      if (championWrestler) {
        currentChampionData = {
          wrestlerId: championWrestler.wrestlerId,
          wrestlerName: championWrestler.name,
          imageUrl: championWrestler.imageUrl || null,
        };
      }
    }

    // ------------------------------------------------------------------
    // 6. Build enriched contender list, excluding the current champion
    // ------------------------------------------------------------------
    const championIds = new Set<string>();
    if (currentChampion) {
      if (Array.isArray(currentChampion)) {
        currentChampion.forEach((id) => championIds.add(id));
      } else {
        championIds.add(currentChampion);
      }
    }

    const filteredRankings = rankings.filter(
      (ranking) => !championIds.has(ranking.wrestlerId),
    );

    const contenders = filteredRankings.map((ranking, index) => {
      const wrestler = wrestlersMap.get(ranking.wrestlerId);
      const previousRank = ranking.previousRank ?? null;
      const isNew = previousRank === null || previousRank === undefined;
      const adjustedRank = index + 1; // Re-rank after filtering out champion
      const movement = isNew ? 0 : (previousRank as number) - adjustedRank;

      return {
        rank: adjustedRank,
        wrestlerId: ranking.wrestlerId,
        wrestlerName: wrestler?.name || 'Unknown',
        imageUrl: wrestler?.imageUrl || null,
        rankingScore: ranking.rankingScore,
        winPercentage: ranking.winPercentage,
        currentStreak: ranking.currentStreak,
        matchesInPeriod: ranking.matchesInPeriod,
        winsInPeriod: ranking.winsInPeriod,
        previousRank: previousRank,
        movement,
        isNew,
      };
    });

    // ------------------------------------------------------------------
    // 7. Determine the most recent calculatedAt timestamp
    // ------------------------------------------------------------------
    const calculatedAt =
      rankings.length > 0
        ? rankings.reduce<string>(
            (latest, r) => (r.calculatedAt > latest ? r.calculatedAt : latest),
            rankings[0].calculatedAt
          )
        : null;

    return success({
      championshipId,
      championshipName: championship.name || championshipId,
      divisionId: championship.divisionId || null,
      currentChampion: currentChampionData,
      contenders,
      calculatedAt,
    });
  } catch (err) {
    console.error('Error fetching contenders:', err);
    return serverError('Failed to fetch contenders');
  }
};
