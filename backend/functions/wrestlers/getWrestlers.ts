import { APIGatewayProxyHandler } from 'aws-lambda';
import { dynamoDb, TableNames } from '../../lib/dynamodb';
import { success, serverError } from '../../lib/response';

export const handler: APIGatewayProxyHandler = async () => {
  try {
    const result = await dynamoDb.scan({
      TableName: TableNames.WRESTLERS,
    });

    const wrestlers = (result.Items || []);

    return success(wrestlers);
  } catch (err) {
    console.error('Error fetching wrestlers:', err);
    return serverError('Failed to fetch wrestlers');
  }
};
