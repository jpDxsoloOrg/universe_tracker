import { dynamoDb, TableNames } from '../../lib/dynamodb';
import { handlerFactory } from '../../lib/handlers';
import { badRequest, notFound } from '../../lib/response';

export const handler = handlerFactory({
  tableName: TableNames.CHAMPIONSHIPS,
  idField: 'championshipId',
  entityName: 'championship',
  requiredFields: ['name', 'type'],
  optionalFields: ['currentChampion', 'divisionId', 'imageUrl', 'companyId'],
  defaults: {
    isActive: true,
  },
  validate: async (body, _event) => {
    if (body.type !== 'singles' && body.type !== 'tag') {
      return badRequest('Type must be either "singles" or "tag"');
    }
    if (body.companyId) {
      const companyResult = await dynamoDb.get({
        TableName: TableNames.COMPANIES,
        Key: { companyId: body.companyId },
      });
      if (!companyResult.Item) {
        return notFound('Company not found');
      }
    }
    return null;
  },
});
