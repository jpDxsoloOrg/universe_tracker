import { APIGatewayProxyHandler } from 'aws-lambda';
import { dynamoDb, TableNames } from '../../lib/dynamodb';
import { success, serverError } from '../../lib/response';

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const companyId = event.queryStringParameters?.companyId;
    const unassigned = event.queryStringParameters?.unassigned;

    if (companyId) {
      // Filter wrestlers by companyId using FilterExpression on scan
      const result = await dynamoDb.scan({
        TableName: TableNames.WRESTLERS,
        FilterExpression: '#companyId = :companyId',
        ExpressionAttributeNames: { '#companyId': 'companyId' },
        ExpressionAttributeValues: { ':companyId': companyId },
      });

      return success(result.Items || []);
    }

    if (unassigned === 'true') {
      // Filter wrestlers with no companyId
      const result = await dynamoDb.scan({
        TableName: TableNames.WRESTLERS,
        FilterExpression: 'attribute_not_exists(#companyId) OR #companyId = :empty',
        ExpressionAttributeNames: { '#companyId': 'companyId' },
        ExpressionAttributeValues: { ':empty': '' },
      });

      return success(result.Items || []);
    }

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
