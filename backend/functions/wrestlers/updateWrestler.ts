import { APIGatewayProxyHandler } from 'aws-lambda';
import { dynamoDb, TableNames } from '../../lib/dynamodb';
import { buildUpdateExpression, getOrNotFound } from '../../lib/dynamodbUtils';
import { success, badRequest, serverError } from '../../lib/response';
import { parseBody } from '../../lib/parseBody';

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const wrestlerId = event.pathParameters?.wrestlerId;

    if (!wrestlerId) {
      return badRequest('Wrestler ID is required');
    }

    const { data: body, error: parseError } = parseBody(event);
    if (parseError) return parseError;

    const wrestlerResult = await getOrNotFound(TableNames.WRESTLERS, { wrestlerId }, 'Wrestler not found');
    if ('notFoundResponse' in wrestlerResult) {
      return wrestlerResult.notFoundResponse;
    }

    const updateFields: Record<string, unknown> = {
      name: body.name,
      imageUrl: body.imageUrl,
      nickname: body.nickname,
      finisher: body.finisher,
      weight: body.weight,
      height: body.height,
      hometown: body.hometown,
      alignment: body.alignment,
    };
    const removeFields: string[] = [];

    if (body.divisionId !== undefined) {
      if (body.divisionId === '' || body.divisionId === null) {
        // Remove divisionId if empty string or null
        removeFields.push('divisionId');
      } else {
        // Validate that the division exists
        const divisionResult = await getOrNotFound(
          TableNames.DIVISIONS,
          { divisionId: body.divisionId },
          `Division ${body.divisionId} not found`
        );
        if ('notFoundResponse' in divisionResult) {
          return divisionResult.notFoundResponse;
        }
        updateFields.divisionId = body.divisionId;
      }
    }

    if (body.companyId !== undefined) {
      if (body.companyId === '' || body.companyId === null) {
        // Remove companyId if empty string or null (unassign from company)
        removeFields.push('companyId');
      } else {
        // Validate that the company exists
        const companyResult = await getOrNotFound(
          TableNames.COMPANIES,
          { companyId: body.companyId },
          `Company ${body.companyId} not found`
        );
        if ('notFoundResponse' in companyResult) {
          return companyResult.notFoundResponse;
        }
        updateFields.companyId = body.companyId;
      }
    }

    const updateExpr = buildUpdateExpression(updateFields, {
      removeFields,
    });

    if (!updateExpr.hasChanges) {
      return badRequest('No valid fields to update');
    }

    const result = await dynamoDb.update({
      TableName: TableNames.WRESTLERS,
      Key: { wrestlerId },
      UpdateExpression: updateExpr.UpdateExpression,
      ExpressionAttributeNames: updateExpr.ExpressionAttributeNames,
      ExpressionAttributeValues: updateExpr.ExpressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    });

    return success(result.Attributes);
  } catch (err) {
    console.error('Error updating wrestler:', err);
    return serverError('Failed to update wrestler');
  }
};
