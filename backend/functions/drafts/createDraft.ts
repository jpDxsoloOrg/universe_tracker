import { APIGatewayProxyHandler } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { dynamoDb, TableNames } from '../../lib/dynamodb';
import { created, badRequest, notFound, serverError } from '../../lib/response';
import { parseBody } from '../../lib/parseBody';

interface CreateDraftBody {
  name: string;
  type: 'global' | 'inter-company';
  participatingCompanyIds: string[];
  rounds: number;
  snakeOrder?: boolean;
  draftOrder?: string[];
  protectedPicksPerCompany?: number;
  includeGlobalPool?: boolean;
}

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const { data: body, error: parseError } = parseBody<CreateDraftBody>(event);
    if (parseError) return parseError;

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return badRequest('name is required');
    }

    if (body.type !== 'global' && body.type !== 'inter-company') {
      return badRequest('type must be "global" or "inter-company"');
    }

    if (!Array.isArray(body.participatingCompanyIds) || body.participatingCompanyIds.length < 2) {
      return badRequest('participatingCompanyIds must contain at least 2 company IDs');
    }

    if (!Number.isInteger(body.rounds) || body.rounds < 1) {
      return badRequest('rounds must be a positive integer');
    }

    // Validate all company IDs exist
    for (const companyId of body.participatingCompanyIds) {
      const companyResult = await dynamoDb.get({
        TableName: TableNames.COMPANIES,
        Key: { companyId },
      });
      if (!companyResult.Item) {
        return notFound(`Company not found: ${companyId}`);
      }
    }

    // Validate draftOrder if provided
    const draftOrder = body.draftOrder || [...body.participatingCompanyIds];
    if (body.draftOrder) {
      const orderSet = new Set(body.draftOrder);
      const companySet = new Set(body.participatingCompanyIds);
      if (orderSet.size !== companySet.size || ![...orderSet].every((id) => companySet.has(id))) {
        return badRequest('draftOrder must contain exactly the same IDs as participatingCompanyIds');
      }
    }

    const now = new Date().toISOString();
    const item: Record<string, unknown> = {
      draftId: uuidv4(),
      name,
      type: body.type,
      participatingCompanyIds: body.participatingCompanyIds,
      rounds: body.rounds,
      snakeOrder: body.snakeOrder ?? false,
      draftOrder,
      protectedPicksPerCompany: body.protectedPicksPerCompany ?? 0,
      includeGlobalPool: body.includeGlobalPool ?? false,
      status: 'setup',
      currentRound: 0,
      currentPickIndex: 0,
      picks: [],
      protections: [],
      createdAt: now,
      updatedAt: now,
    };

    await dynamoDb.put({
      TableName: TableNames.DRAFTS,
      Item: item,
    });

    return created(item);
  } catch (err) {
    console.error('Error creating draft:', err);
    return serverError('Failed to create draft');
  }
};
