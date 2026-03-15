import { APIGatewayProxyHandler } from 'aws-lambda';
import { dynamoDb, TableNames } from '../../lib/dynamodb';
import { success, serverError } from '../../lib/response';

const ACTIVITY_TYPES = ['match', 'championship', 'tournament', 'season'] as const;
type ActivityTypeFilter = (typeof ACTIVITY_TYPES)[number];

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

function parseQuery(event: { queryStringParameters?: Record<string, string | undefined> | null }): {
  limit: number;
  cursor: string | null;
  typeFilter: ActivityTypeFilter | null;
} {
  const params = event.queryStringParameters || {};
  const limit = Math.min(Math.max(parseInt(params.limit || '20', 10) || 20, 1), 100);
  const cursor = params.cursor && params.cursor.trim() ? params.cursor.trim() : null;
  const typeParam = (params.type || '').toLowerCase();
  const typeFilter = ACTIVITY_TYPES.includes(typeParam as ActivityTypeFilter)
    ? (typeParam as ActivityTypeFilter)
    : null;
  return { limit, cursor, typeFilter };
}

async function fetchWrestlerNames(wrestlerIds: Set<string>): Promise<Record<string, string>> {
  const names: Record<string, string> = {};
  for (const wrestlerId of wrestlerIds) {
    const result = await dynamoDb.get({
      TableName: TableNames.WRESTLERS,
      Key: { wrestlerId },
    });
    if (result.Item) {
      names[wrestlerId] = (result.Item.name as string) || wrestlerId;
    }
  }
  return names;
}

async function fetchChampionshipNames(championshipIds: Set<string>): Promise<Record<string, string>> {
  const names: Record<string, string> = {};
  for (const championshipId of championshipIds) {
    const result = await dynamoDb.get({
      TableName: TableNames.CHAMPIONSHIPS,
      Key: { championshipId },
    });
    if (result.Item) {
      names[championshipId] = (result.Item.name as string) || championshipId;
    }
  }
  return names;
}

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const { limit, cursor, typeFilter } = parseQuery(event);

    const includeMatch = !typeFilter || typeFilter === 'match';
    const includeChampionship = !typeFilter || typeFilter === 'championship';
    const includeSeason = !typeFilter || typeFilter === 'season';
    const includeTournament = !typeFilter || typeFilter === 'tournament';
    const rawItems: { type: ActivityItemType; timestamp: string; id: string; summary: string; metadata: Record<string, unknown> }[] = [];
    const wrestlerIds = new Set<string>();
    const championshipIds = new Set<string>();

    if (includeMatch) {
      const matches = await dynamoDb.scanAll({
        TableName: TableNames.MATCHES,
        FilterExpression: '#s = :status',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':status': 'completed' },
      });
      for (const m of matches) {
        const updatedAt = m.updatedAt as string | undefined;
        if (!updatedAt) continue; // only show matches that have been recorded/updated with updatedAt
        const date = m.date as string;
        const participants = (m.participants as string[]) || [];
        const winners = (m.winners as string[]) || [];
        const losers = (m.losers as string[]) || [];
        participants.forEach((p: string) => wrestlerIds.add(p));
        rawItems.push({
          type: 'match_result',
          timestamp: updatedAt,
          id: `match-${m.matchId as string}`,
          summary: '', // filled after we have names
          metadata: {
            matchId: m.matchId,
            date,
            matchFormat: m.matchFormat,
            stipulationId: m.stipulationId,
            participants,
            winners,
            losers,
            isChampionship: m.isChampionship,
            championshipId: m.championshipId,
            tournamentId: m.tournamentId,
            eventId: m.eventId,
          },
        });
      }
    }

    if (includeChampionship) {
      const history = await dynamoDb.scanAll({
        TableName: TableNames.CHAMPIONSHIP_HISTORY,
      });
      for (const h of history) {
        const updatedAt = h.updatedAt as string | undefined;
        if (!updatedAt) continue; // only show championship history with updatedAt
        const wonDate = h.wonDate as string;
        championshipIds.add(h.championshipId as string);
        const champion = h.champion;
        if (typeof champion === 'string') wrestlerIds.add(champion);
        else if (Array.isArray(champion)) champion.forEach((c: string) => wrestlerIds.add(c));
        rawItems.push({
          type: 'championship_change',
          timestamp: updatedAt,
          id: `championship-${h.championshipId as string}-${wonDate}`,
          summary: '',
          metadata: {
            championshipId: h.championshipId,
            wonDate,
            champion,
            matchId: h.matchId,
            lostDate: h.lostDate,
            daysHeld: h.daysHeld,
          },
        });
      }
    }

    if (includeSeason) {
      const seasons = await dynamoDb.scanAll({
        TableName: TableNames.SEASONS,
      });
      for (const s of seasons) {
        const updatedAt = s.updatedAt as string | undefined;
        if (!updatedAt) continue; // only show seasons with updatedAt
        const startDate = s.startDate as string;
        const status = s.status as string;
        rawItems.push({
          type: 'season_event',
          timestamp: updatedAt,
          id: `season-start-${s.seasonId as string}`,
          summary: '',
          metadata: {
            seasonId: s.seasonId,
            name: s.name,
            startDate,
            endDate: s.endDate,
            status,
            event: 'started',
          },
        });
        if (status === 'completed' && s.endDate) {
          rawItems.push({
            type: 'season_event',
            timestamp: updatedAt,
            id: `season-end-${s.seasonId as string}`,
            summary: '',
            metadata: {
              seasonId: s.seasonId,
              name: s.name,
              startDate: s.startDate,
              endDate: s.endDate,
              status,
              event: 'ended',
            },
          });
        }
      }
    }

    if (includeTournament) {
      const tournaments = await dynamoDb.scanAll({
        TableName: TableNames.TOURNAMENTS,
      });
      for (const t of tournaments) {
        const updatedAt = (t.updatedAt as string | undefined) || (t.createdAt as string | undefined);
        if (!updatedAt) continue; // only show tournaments with updatedAt or createdAt
        const status = t.status as string;
        const winner = t.winner as string | undefined;
        if (winner) wrestlerIds.add(winner);
        rawItems.push({
          type: 'tournament_result',
          timestamp: updatedAt,
          id: `tournament-${t.tournamentId as string}`,
          summary: '',
          metadata: {
            tournamentId: t.tournamentId,
            name: t.name,
            type: t.type,
            status,
            winner,
            createdAt: t.createdAt,
          },
        });
      }
    }

    const wrestlerNames = await fetchWrestlerNames(wrestlerIds);
    const championshipNames = await fetchChampionshipNames(championshipIds);

    for (const item of rawItems) {
      if (item.type === 'match_result') {
        const meta = item.metadata;
        const winners = (meta.winners as string[]) || [];
        const losers = (meta.losers as string[]) || [];
        const winnerNames = winners.map((id: string) => wrestlerNames[id] || id);
        const loserNames = losers.map((id: string) => wrestlerNames[id] || id);
        meta.winnerNames = winnerNames;
        meta.loserNames = loserNames;
        item.summary = winnerNames.length && loserNames.length
          ? `${winnerNames.join(' & ')} def. ${loserNames.join(' & ')}`
          : 'Match completed';
      } else if (item.type === 'championship_change') {
        const meta = item.metadata;
        const champ = meta.champion;
        const champNames = Array.isArray(champ)
          ? (champ as string[]).map((id: string) => wrestlerNames[id] || id)
          : [wrestlerNames[champ as string] || (champ as string)];
        meta.championNames = champNames;
        meta.championshipName = championshipNames[meta.championshipId as string] || meta.championshipId;
        item.summary = `${meta.championshipName}: ${champNames.join(' & ')} crowned`;
      } else if (item.type === 'season_event') {
        const meta = item.metadata;
        const name = meta.name as string;
        item.summary = meta.event === 'ended' ? `Season "${name}" ended` : `Season "${name}" started`;
      } else if (item.type === 'tournament_result') {
        const meta = item.metadata;
        const name = meta.name as string;
        const winner = meta.winner as string | undefined;
        meta.winnerName = winner ? wrestlerNames[winner] || winner : undefined;
        item.summary = winner
          ? `Tournament "${name}" completed — ${meta.winnerName || winner} won`
          : `Tournament "${name}"`;
      }
    }

    // Sort by timestamp desc, then id asc so same-timestamp items have deterministic order and cursor is stable
    rawItems.sort((a, b) => {
      const ta = new Date(a.timestamp).getTime();
      const tb = new Date(b.timestamp).getTime();
      if (tb !== ta) return tb - ta;
      return a.id.localeCompare(b.id);
    });

    let filtered = rawItems;
    if (cursor) {
      let cursorTime: number;
      let cursorId: string | null = null;
      if (cursor.includes('|')) {
        const [ts, id] = cursor.split('|');
        if (ts && id) {
          cursorTime = new Date(ts).getTime();
          cursorId = id;
        } else {
          cursorTime = new Date(cursor).getTime();
        }
      } else {
        cursorTime = new Date(cursor).getTime();
      }
      filtered = rawItems.filter((i) => {
        const t = new Date(i.timestamp).getTime();
        if (t < cursorTime) return true;
        if (t === cursorTime && cursorId !== null) return i.id > cursorId;
        return false;
      });
    }

    const items = filtered.slice(0, limit).map(({ id, type, timestamp, summary, metadata }) => ({
      id,
      type,
      timestamp,
      summary,
      metadata,
    }));

    const hasMore = filtered.length > limit;
    const nextCursor =
      hasMore && items.length > 0
        ? `${items[items.length - 1].timestamp}|${items[items.length - 1].id}`
        : null;

    return success({
      items,
      nextCursor,
    } as ActivityFeedResponse);
  } catch (err) {
    console.error('Error fetching activity:', err);
    return serverError('Failed to fetch activity');
  }
};
