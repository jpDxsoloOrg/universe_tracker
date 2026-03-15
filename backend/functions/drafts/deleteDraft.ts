import { APIGatewayProxyHandler } from 'aws-lambda';
import { dynamoDb, TableNames } from '../../lib/dynamodb';
import { getOrNotFound } from '../../lib/dynamodbUtils';
import { noContent, badRequest, serverError } from '../../lib/response';

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

    if (draft.status !== 'setup' && draft.status !== 'completed') {
      return badRequest('Draft can only be deleted when in setup or completed status');
    }

    await dynamoDb.delete({
      TableName: TableNames.DRAFTS,
      Key: { draftId },
    });

    return noContent();
  } catch (err) {
    console.error('Error deleting draft:', err);
    return serverError('Failed to delete draft');
  }
};
