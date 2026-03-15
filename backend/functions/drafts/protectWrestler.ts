import { APIGatewayProxyHandler } from 'aws-lambda';
import { dynamoDb, TableNames } from '../../lib/dynamodb';
import { success, badRequest, notFound, serverError } from '../../lib/response';
import { parseBody } from '../../lib/parseBody';

interface ProtectWrestlerBody {
  companyId: string;
  wrestlerId: string;
}

interface ProtectionRecord {
  companyId: string;
  wrestlerId: string;
}

interface DraftRecord {
  draftId: string;
  type: 'global' | 'inter-company';
  status: string;
  participatingCompanyIds: string[];
  protectedPicksPerCompany: number;
  protections: ProtectionRecord[];
  [key: string]: unknown;
}

interface WrestlerRecord {
  wrestlerId: string;
  companyId?: string;
  [key: string]: unknown;
}

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const draftId = event.pathParameters?.draftId;

    if (!draftId) {
      return badRequest('Draft ID is required');
    }

    const { data: body, error: parseError } = parseBody<ProtectWrestlerBody>(event);
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

    if (draft.status !== 'setup') {
      return badRequest('Protections can only be added during setup');
    }

    if (draft.type !== 'inter-company') {
      return badRequest('Protections are only available for inter-company drafts');
    }

    if (!draft.participatingCompanyIds.includes(companyId)) {
      return badRequest('Company is not participating in this draft');
    }

    if (draft.protectedPicksPerCompany <= 0) {
      return badRequest('No protected picks are allowed for this draft');
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

    if (wrestler.companyId !== companyId) {
      return badRequest('Wrestler must belong to the protecting company');
    }

    // Check company hasn't exceeded protection limit
    const companyProtections = draft.protections.filter(
      (p: ProtectionRecord) => p.companyId === companyId
    );
    if (companyProtections.length >= draft.protectedPicksPerCompany) {
      return badRequest('Company has reached the maximum number of protected picks');
    }

    // Check wrestler not already protected
    const alreadyProtected = draft.protections.some(
      (p: ProtectionRecord) => p.wrestlerId === wrestlerId
    );
    if (alreadyProtected) {
      return badRequest('Wrestler is already protected');
    }

    const now = new Date().toISOString();
    const protection: ProtectionRecord = { companyId, wrestlerId };

    await dynamoDb.update({
      TableName: TableNames.DRAFTS,
      Key: { draftId },
      UpdateExpression: 'SET protections = list_append(protections, :newProtection), updatedAt = :now',
      ExpressionAttributeValues: {
        ':newProtection': [protection],
        ':now': now,
      },
      ReturnValues: 'ALL_NEW',
    });

    return success({ protection });
  } catch (err) {
    console.error('Error protecting wrestler:', err);
    return serverError('Failed to protect wrestler');
  }
};
