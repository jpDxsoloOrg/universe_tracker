import { APIGatewayProxyHandler } from 'aws-lambda';
import { dynamoDb, TableNames } from '../../lib/dynamodb';
import { success, badRequest, notFound, serverError } from '../../lib/response';

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const draftId = event.pathParameters?.draftId;

    if (!draftId) {
      return badRequest('Draft ID is required');
    }

    const result = await dynamoDb.get({
      TableName: TableNames.DRAFTS,
      Key: { draftId },
    });

    if (!result.Item) {
      return notFound('Draft not found');
    }

    return success(result.Item);
  } catch (err) {
    console.error('Error fetching draft:', err);
    return serverError('Failed to fetch draft');
  }
};
