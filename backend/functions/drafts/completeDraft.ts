import { APIGatewayProxyHandler } from 'aws-lambda';
import { dynamoDb, TableNames } from '../../lib/dynamodb';
import { getOrNotFound } from '../../lib/dynamodbUtils';
import { success, badRequest, serverError } from '../../lib/response';

interface DraftRecord {
  draftId: string;
  status: string;
  [key: string]: unknown;
}

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const draftId = event.pathParameters?.draftId;

    if (!draftId) {
      return badRequest('Draft ID is required');
    }

    const draftResult = await getOrNotFound<DraftRecord>(
      TableNames.DRAFTS,
      { draftId },
      'Draft not found'
    );
    if ('notFoundResponse' in draftResult) {
      return draftResult.notFoundResponse;
    }

    const draft = draftResult.item;

    if (draft.status !== 'active') {
      return badRequest('Draft can only be completed when in active status');
    }

    const now = new Date().toISOString();

    const result = await dynamoDb.update({
      TableName: TableNames.DRAFTS,
      Key: { draftId },
      UpdateExpression: 'SET #s = :status, updatedAt = :now',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: {
        ':status': 'completed',
        ':now': now,
      },
      ReturnValues: 'ALL_NEW',
    });

    return success(result.Attributes);
  } catch (err) {
    console.error('Error completing draft:', err);
    return serverError('Failed to complete draft');
  }
};
