import { APIGatewayProxyHandler } from 'aws-lambda';
import { dynamoDb, TableNames } from '../../lib/dynamodb';
import { getOrNotFound } from '../../lib/dynamodbUtils';
import { noContent, badRequest, serverError, conflict } from '../../lib/response';

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const wrestlerId = event.pathParameters?.wrestlerId;

    if (!wrestlerId) {
      return badRequest('Wrestler ID is required');
    }

    const wrestlerResult = await getOrNotFound(TableNames.WRESTLERS, { wrestlerId }, 'Wrestler not found');
    if ('notFoundResponse' in wrestlerResult) {
      return wrestlerResult.notFoundResponse;
    }

    // Check if wrestler is a current champion
    const championshipsResult = await dynamoDb.scan({
      TableName: TableNames.CHAMPIONSHIPS,
      FilterExpression: 'contains(#currentChampion, :wrestlerId)',
      ExpressionAttributeNames: {
        '#currentChampion': 'currentChampion',
      },
      ExpressionAttributeValues: {
        ':wrestlerId': wrestlerId,
      },
    });

    if (championshipsResult.Items && championshipsResult.Items.length > 0) {
      const championshipNames = championshipsResult.Items.map((c: Record<string, unknown>) => c.name).join(', ');
      return conflict(
        `Cannot delete wrestler. They are currently champion of: ${championshipNames}. Remove their championship first.`
      );
    }

    // Delete the wrestler
    await dynamoDb.delete({
      TableName: TableNames.WRESTLERS,
      Key: { wrestlerId },
    });

    // Also delete from season standings
    const standingsResult = await dynamoDb.query({
      TableName: TableNames.SEASON_STANDINGS,
      IndexName: 'WrestlerIndex',
      KeyConditionExpression: '#wrestlerId = :wrestlerId',
      ExpressionAttributeNames: {
        '#wrestlerId': 'wrestlerId',
      },
      ExpressionAttributeValues: {
        ':wrestlerId': wrestlerId,
      },
    });

    if (standingsResult.Items && standingsResult.Items.length > 0) {
      for (const standing of standingsResult.Items) {
        await dynamoDb.delete({
          TableName: TableNames.SEASON_STANDINGS,
          Key: {
            seasonId: (standing as Record<string, unknown>).seasonId,
            wrestlerId: wrestlerId,
          },
        });
      }
    }

    return noContent();
  } catch (err) {
    console.error('Error deleting wrestler:', err);
    return serverError('Failed to delete wrestler');
  }
};
