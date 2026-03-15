import { APIGatewayProxyHandler } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { dynamoDb, TableNames } from '../../lib/dynamodb';
import { created, badRequest, notFound, serverError } from '../../lib/response';
import { parseBody } from '../../lib/parseBody';

interface ScheduleMatchBody {
  date?: string;
  matchFormat: string; // "singles", "tag", "triple-threat", etc.
  stipulationId?: string; // References Stipulations table
  participants: string[];
  isChampionship: boolean;
  championshipId?: string;
  tournamentId?: string;
  seasonId?: string;
  eventId?: string;
  designation?: string;
}

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const { data: body, error: parseError } = parseBody<ScheduleMatchBody>(event);
    if (parseError) return parseError;

    if (!body.matchFormat || !body.participants || body.participants.length < 2) {
      return badRequest('matchFormat and at least 2 participants are required');
    }

    // Resolve date: use provided date, or event date if eventId given, or today
    let resolvedDate = body.date;
    if (!resolvedDate && body.eventId) {
      const eventForDate = await dynamoDb.get({
        TableName: TableNames.EVENTS,
        Key: { eventId: body.eventId },
      });
      if (eventForDate.Item) {
        resolvedDate = (eventForDate.Item as Record<string, unknown>).date as string;
      }
    }
    if (!resolvedDate) {
      resolvedDate = new Date().toISOString();
    }

    if (body.isChampionship && !body.championshipId) {
      return badRequest('Championship ID is required for championship matches');
    }

    // Check for duplicate participants
    const uniqueParticipants = new Set(body.participants);
    if (uniqueParticipants.size !== body.participants.length) {
      return badRequest('Duplicate participants are not allowed');
    }

    // Validate all participants exist
    const wrestlerValidationPromises = body.participants.map(async (wrestlerId) => {
      const wrestler = await dynamoDb.get({
        TableName: TableNames.WRESTLERS,
        Key: { wrestlerId },
      });
      return { wrestlerId, exists: !!wrestler.Item, wrestler: wrestler.Item };
    });

    const wrestlerResults = await Promise.all(wrestlerValidationPromises);
    const missingWrestlers = wrestlerResults.filter((w) => !w.exists).map((w) => w.wrestlerId);

    if (missingWrestlers.length > 0) {
      return notFound(`Wrestlers not found: ${missingWrestlers.join(', ')}`);
    }

    // Validate championship exists if provided
    if (body.championshipId) {
      const championship = await dynamoDb.get({
        TableName: TableNames.CHAMPIONSHIPS,
        Key: { championshipId: body.championshipId },
      });

      if (!championship.Item) {
        return notFound(`Championship not found: ${body.championshipId}`);
      }

      // Enforce division restriction: all participants must belong to the championship's division
      const champDivisionId = championship.Item.divisionId as string | undefined;
      if (champDivisionId) {
        const wrongDivision = wrestlerResults.filter((w) => {
          const wrestlerDivision = (w.wrestler as Record<string, unknown>)?.divisionId as string | undefined;
          return wrestlerDivision !== champDivisionId;
        });

        if (wrongDivision.length > 0) {
          return badRequest(
            `Championship is locked to a division. The following participants are not in the correct division: ${wrongDivision.map((w) => w.wrestlerId).join(', ')}`,
          );
        }
      }
    }

    // Validate tournament exists if provided
    if (body.tournamentId) {
      const tournament = await dynamoDb.get({
        TableName: TableNames.TOURNAMENTS,
        Key: { tournamentId: body.tournamentId },
      });

      if (!tournament.Item) {
        return notFound(`Tournament not found: ${body.tournamentId}`);
      }

      // Ensure tournament is not completed
      if (tournament.Item.status === 'completed') {
        return badRequest('Cannot schedule match for a completed tournament');
      }
    }

    // Validate season exists and is active if provided
    if (body.seasonId) {
      const season = await dynamoDb.get({
        TableName: TableNames.SEASONS,
        Key: { seasonId: body.seasonId },
      });

      if (!season.Item) {
        return notFound(`Season not found: ${body.seasonId}`);
      }

      // Ensure season is active
      if (season.Item.status !== 'active') {
        return badRequest('Cannot schedule match for an inactive season');
      }
    }

    // Validate stipulationId exists if provided
    if (body.stipulationId) {
      const stipulation = await dynamoDb.get({
        TableName: TableNames.STIPULATIONS,
        Key: { stipulationId: body.stipulationId },
      });

      if (!stipulation.Item) {
        return notFound(`Stipulation not found: ${body.stipulationId}`);
      }
    }

    const now = new Date().toISOString();
    const match: Record<string, unknown> = {
      matchId: uuidv4(),
      date: resolvedDate,
      matchFormat: body.matchFormat,
      stipulationId: body.stipulationId,
      participants: body.participants,
      isChampionship: body.isChampionship,
      championshipId: body.championshipId,
      tournamentId: body.tournamentId,
      seasonId: body.seasonId,
      status: 'scheduled',
      createdAt: now,
    };

    await dynamoDb.put({
      TableName: TableNames.MATCHES,
      Item: match,
    });

    // If an event was specified, auto-add the match to the event's matchCards
    if (body.eventId) {
      const eventResult = await dynamoDb.get({
        TableName: TableNames.EVENTS,
        Key: { eventId: body.eventId },
      });

      if (eventResult.Item) {
        const existingCards = ((eventResult.Item as Record<string, unknown>).matchCards as unknown[] | undefined) || [];
        const newCard = {
          matchId: match.matchId as string,
          position: existingCards.length + 1,
          designation: body.designation || 'midcard',
        };

        await dynamoDb.update({
          TableName: TableNames.EVENTS,
          Key: { eventId: body.eventId },
          UpdateExpression: 'SET matchCards = list_append(if_not_exists(matchCards, :empty), :newCard), updatedAt = :now',
          ExpressionAttributeValues: {
            ':newCard': [newCard],
            ':empty': [],
            ':now': new Date().toISOString(),
          },
        });
      }
    }

    return created(match);
  } catch (err) {
    console.error('Error scheduling match:', err);
    return serverError('Failed to schedule match');
  }
};
