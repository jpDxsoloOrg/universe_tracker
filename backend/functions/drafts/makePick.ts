import { APIGatewayProxyHandler } from 'aws-lambda';
import { dynamoDb, TableNames } from '../../lib/dynamodb';
import { success, badRequest, notFound, serverError } from '../../lib/response';
import { parseBody } from '../../lib/parseBody';

interface MakePickBody {
  companyId: string;
  wrestlerId: string;
}

interface DraftRecord {
  draftId: string;
  type: 'global' | 'inter-company';
  status: string;
  participatingCompanyIds: string[];
  draftOrder: string[];
  currentRound: number;
  currentPickIndex: number;
  rounds: number;
  snakeOrder: boolean;
  picks: PickRecord[];
  protections: ProtectionRecord[];
  includeGlobalPool: boolean;
  [key: string]: unknown;
}

interface PickRecord {
  pickNumber: number;
  round: number;
  companyId: string;
  wrestlerId: string;
  previousCompanyId?: string;
  pickedAt: string;
}

interface ProtectionRecord {
  companyId: string;
  wrestlerId: string;
}

interface WrestlerRecord {
  wrestlerId: string;
  companyId?: string;
  [key: string]: unknown;
}

function getExpectedCompany(draft: DraftRecord): string {
  const { draftOrder, currentRound, currentPickIndex, snakeOrder } = draft;
  const companiesPerRound = draftOrder.length;
  const indexInRound = currentPickIndex % companiesPerRound;
  // Snake order: odd rounds (1-indexed) go forward, even rounds go reverse
  const isReversed = snakeOrder && currentRound % 2 === 0;
  if (isReversed) {
    return draftOrder[companiesPerRound - 1 - indexInRound];
  }
  return draftOrder[indexInRound];
}

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const draftId = event.pathParameters?.draftId;

    if (!draftId) {
      return badRequest('Draft ID is required');
    }

    const { data: body, error: parseError } = parseBody<MakePickBody>(event);
    if (parseError) return parseError;

    const { companyId, wrestlerId } = body;

    if (!companyId || !wrestlerId) {
      return badRequest('companyId and wrestlerId are required');
    }

    // Get draft
    const draftResult = await dynamoDb.get({
      TableName: TableNames.DRAFTS,
      Key: { draftId },
    });

    if (!draftResult.Item) {
      return notFound('Draft not found');
    }

    const draft = draftResult.Item as unknown as DraftRecord;

    if (draft.status !== 'active') {
      return badRequest('Draft must be active to make picks');
    }

    // Check it's this company's turn
    const expectedCompany = getExpectedCompany(draft);
    if (companyId !== expectedCompany) {
      return badRequest(`It is not this company's turn. Expected: ${expectedCompany}`);
    }

    // Get wrestler
    const wrestlerResult = await dynamoDb.get({
      TableName: TableNames.WRESTLERS,
      Key: { wrestlerId },
    });

    if (!wrestlerResult.Item) {
      return notFound('Wrestler not found');
    }

    const wrestler = wrestlerResult.Item as unknown as WrestlerRecord;

    // Validate wrestler eligibility based on draft type
    if (draft.type === 'global') {
      if (wrestler.companyId) {
        return badRequest('In a global draft, only unassigned wrestlers can be picked');
      }
    } else {
      // inter-company
      const isUnassigned = !wrestler.companyId;
      const belongsToDifferentParticipant =
        wrestler.companyId &&
        wrestler.companyId !== companyId &&
        draft.participatingCompanyIds.includes(wrestler.companyId);

      if (isUnassigned && !draft.includeGlobalPool) {
        return badRequest('Wrestler is unassigned and includeGlobalPool is not enabled');
      }

      if (!isUnassigned && !belongsToDifferentParticipant) {
        return badRequest('In an inter-company draft, wrestlers must belong to a different participating company or be unassigned (with includeGlobalPool)');
      }
    }

    // Check wrestler not protected
    const isProtected = draft.protections.some(
      (p: ProtectionRecord) => p.wrestlerId === wrestlerId
    );
    if (isProtected) {
      return badRequest('Wrestler is protected and cannot be picked');
    }

    // Check wrestler not already picked
    const alreadyPicked = draft.picks.some(
      (p: PickRecord) => p.wrestlerId === wrestlerId
    );
    if (alreadyPicked) {
      return badRequest('Wrestler has already been picked in this draft');
    }

    // Build pick
    const now = new Date().toISOString();
    const pick: PickRecord = {
      pickNumber: draft.picks.length + 1,
      round: draft.currentRound,
      companyId,
      wrestlerId,
      ...(wrestler.companyId ? { previousCompanyId: wrestler.companyId as string } : {}),
      pickedAt: now,
    };

    // Calculate next state
    const newPickIndex = draft.currentPickIndex + 1;
    const companiesPerRound = draft.draftOrder.length;
    let newRound = draft.currentRound;
    let newStatus: string = 'active';

    if (newPickIndex % companiesPerRound === 0) {
      newRound = draft.currentRound + 1;
    }

    if (newRound > draft.rounds) {
      newStatus = 'completed';
    }

    // Transact: update draft + update wrestler
    const transactItems = [
      {
        Update: {
          TableName: TableNames.DRAFTS,
          Key: { draftId },
          UpdateExpression:
            'SET picks = list_append(picks, :newPick), currentRound = :round, currentPickIndex = :pickIdx, #s = :status, updatedAt = :now',
          ExpressionAttributeNames: { '#s': 'status' },
          ExpressionAttributeValues: {
            ':newPick': [pick],
            ':round': newRound,
            ':pickIdx': newPickIndex,
            ':status': newStatus,
            ':now': now,
          },
        },
      },
      {
        Update: {
          TableName: TableNames.WRESTLERS,
          Key: { wrestlerId },
          UpdateExpression: 'SET companyId = :companyId, updatedAt = :now',
          ExpressionAttributeValues: {
            ':companyId': companyId,
            ':now': now,
          },
        },
      },
    ];

    await dynamoDb.transactWrite({ TransactItems: transactItems });

    // Fetch the updated draft to return full state
    const updatedDraftResult = await dynamoDb.get({
      TableName: TableNames.DRAFTS,
      Key: { draftId },
    });

    return success({
      pick,
      draft: updatedDraftResult.Item,
    });
  } catch (err) {
    console.error('Error making pick:', err);
    return serverError('Failed to make pick');
  }
};
