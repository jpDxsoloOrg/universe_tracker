import { dynamoDb, TableNames } from '../../lib/dynamodb';
import { notFound } from '../../lib/response';
import { handlerFactory } from '../../lib/handlers';

export const handler = handlerFactory({
  tableName: TableNames.WRESTLERS,
  idField: 'wrestlerId',
  entityName: 'wrestler',
  requiredFields: ['name'],
  optionalFields: ['imageUrl', 'divisionId', 'nickname', 'finisher', 'weight', 'height', 'hometown', 'alignment'],
  defaults: {
    wins: 0,
    losses: 0,
    draws: 0,
  },
  validate: async (body, _event) => {
    if (body.divisionId) {
      const divisionResult = await dynamoDb.get({
        TableName: TableNames.DIVISIONS,
        Key: { divisionId: body.divisionId },
      });
      if (!divisionResult.Item) {
        return notFound(`Division ${body.divisionId} not found`);
      }
    }
    if (body.alignment && !['face', 'heel', 'tweener'].includes(body.alignment as string)) {
      return notFound('alignment must be one of: face, heel, tweener');
    }
    return null;
  },
});
