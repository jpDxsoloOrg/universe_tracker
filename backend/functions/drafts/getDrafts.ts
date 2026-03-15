import { APIGatewayProxyHandler } from 'aws-lambda';
import { dynamoDb, TableNames } from '../../lib/dynamodb';
import { success, serverError } from '../../lib/response';

export const handler: APIGatewayProxyHandler = async () => {
  try {
    const result = await dynamoDb.scan({
      TableName: TableNames.DRAFTS,
    });

    const drafts = (result.Items || []) as Record<string, unknown>[];

    // Sort by createdAt descending
    drafts.sort((a, b) => {
      const dateA = (a.createdAt as string) || '';
      const dateB = (b.createdAt as string) || '';
      return dateB.localeCompare(dateA);
    });

    return success(drafts);
  } catch (err) {
    console.error('Error fetching drafts:', err);
    return serverError('Failed to fetch drafts');
  }
};
