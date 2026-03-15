import { APIGatewayProxyHandler } from 'aws-lambda';
import { dynamoDb, TableNames } from '../../lib/dynamodb';
import { getOrNotFound } from '../../lib/dynamodbUtils';
import { noContent, badRequest, serverError, conflict } from '../../lib/response';

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const companyId = event.pathParameters?.companyId;

    if (!companyId) {
      return badRequest('Company ID is required');
    }

    const companyResult = await getOrNotFound(TableNames.COMPANIES, { companyId }, 'Company not found');
    if ('notFoundResponse' in companyResult) {
      return companyResult.notFoundResponse;
    }

    // Check if any wrestlers are assigned to this company
    const wrestlersResult = await dynamoDb.scan({
      TableName: TableNames.WRESTLERS,
      FilterExpression: '#companyId = :companyId',
      ExpressionAttributeNames: {
        '#companyId': 'companyId',
      },
      ExpressionAttributeValues: {
        ':companyId': companyId,
      },
    });

    if (wrestlersResult.Items && wrestlersResult.Items.length > 0) {
      return conflict(
        `Cannot delete company. ${wrestlersResult.Items.length} wrestler(s) are still assigned to this company.`
      );
    }

    // Check if any shows are assigned to this company
    const showsResult = await dynamoDb.query({
      TableName: TableNames.SHOWS,
      IndexName: 'CompanyShowsIndex',
      KeyConditionExpression: '#companyId = :companyId',
      ExpressionAttributeNames: {
        '#companyId': 'companyId',
      },
      ExpressionAttributeValues: {
        ':companyId': companyId,
      },
    });

    if (showsResult.Items && showsResult.Items.length > 0) {
      return conflict(
        `Cannot delete company. ${showsResult.Items.length} show(s) are still assigned to this company.`
      );
    }

    await dynamoDb.delete({
      TableName: TableNames.COMPANIES,
      Key: { companyId },
    });

    return noContent();
  } catch (err) {
    console.error('Error deleting company:', err);
    return serverError('Failed to delete company');
  }
};
