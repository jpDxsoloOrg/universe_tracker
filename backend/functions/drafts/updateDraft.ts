import { APIGatewayProxyHandler } from 'aws-lambda';
import { dynamoDb, TableNames } from '../../lib/dynamodb';
import { buildUpdateExpression, getOrNotFound } from '../../lib/dynamodbUtils';
import { success, badRequest, serverError } from '../../lib/response';
import { parseBody } from '../../lib/parseBody';

interface UpdateDraftBody {
  name?: string;
  rounds?: number;
  snakeOrder?: boolean;
  draftOrder?: string[];
  protectedPicksPerCompany?: number;
  includeGlobalPool?: boolean;
}

interface DraftRecord {
  draftId: string;
  status: string;
  participatingCompanyIds: string[];
  [key: string]: unknown;
}

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const draftId = event.pathParameters?.draftId;

    if (!draftId) {
      return badRequest('Draft ID is required');
    }

    const { data: body, error: parseError } = parseBody<UpdateDraftBody>(event);
    if (parseError) return parseError;

    const draftResult = await getOrNotFound<DraftRecord>(
      TableNames.DRAFTS,
      { draftId },
      'Draft not found'
    );
    if ('notFoundResponse' in draftResult) {
      return draftResult.notFoundResponse;
    }

    const draft = draftResult.item;

    if (draft.status !== 'setup') {
      return badRequest('Draft can only be updated when in setup status');
    }

    // Validate draftOrder if changed
    if (body.draftOrder) {
      const orderSet = new Set(body.draftOrder);
      const companySet = new Set(draft.participatingCompanyIds);
      if (orderSet.size !== companySet.size || ![...orderSet].every((id) => companySet.has(id))) {
        return badRequest('draftOrder must contain exactly the same IDs as participatingCompanyIds');
      }
    }

    if (body.rounds !== undefined && (!Number.isInteger(body.rounds) || body.rounds < 1)) {
      return badRequest('rounds must be a positive integer');
    }

    const updateExpr = buildUpdateExpression({
      name: body.name,
      rounds: body.rounds,
      snakeOrder: body.snakeOrder,
      draftOrder: body.draftOrder,
      protectedPicksPerCompany: body.protectedPicksPerCompany,
      includeGlobalPool: body.includeGlobalPool,
    });

    if (!updateExpr.hasChanges) {
      return badRequest('No valid fields to update');
    }

    const result = await dynamoDb.update({
      TableName: TableNames.DRAFTS,
      Key: { draftId },
      UpdateExpression: updateExpr.UpdateExpression,
      ExpressionAttributeNames: updateExpr.ExpressionAttributeNames,
      ExpressionAttributeValues: updateExpr.ExpressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    });

    return success(result.Attributes);
  } catch (err) {
    console.error('Error updating draft:', err);
    return serverError('Failed to update draft');
  }
};
