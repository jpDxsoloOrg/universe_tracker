import { APIGatewayProxyHandler } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { parseBody } from '../../lib/parseBody';
import { dynamoDb, TableNames } from '../../lib/dynamodb';
import { created, badRequest, notFound, serverError } from '../../lib/response';

interface WrestlerImport {
  name: string;
  nickname?: string;
  finisher?: string;
  weight?: string;
  height?: string;
  hometown?: string;
  alignment?: string;
  imageUrl?: string;
}

interface ImportWrestlersBody {
  wrestlers: WrestlerImport[];
  companyId?: string;
}

interface ImportError {
  index: number;
  name: string;
  reason: string;
}

const VALID_ALIGNMENTS = ['face', 'heel', 'tweener'];
const MAX_WRESTLERS = 500;

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const parsed = parseBody<ImportWrestlersBody>(event);
    if (parsed.error) {
      return parsed.error;
    }

    const { wrestlers, companyId } = parsed.data;

    // Validate wrestlers array
    if (!Array.isArray(wrestlers)) {
      return badRequest('wrestlers must be an array');
    }

    if (wrestlers.length === 0) {
      return badRequest('wrestlers array must not be empty');
    }

    if (wrestlers.length > MAX_WRESTLERS) {
      return badRequest(`wrestlers array must not exceed ${MAX_WRESTLERS} items`);
    }

    // If companyId provided, verify company exists
    if (companyId) {
      const companyResult = await dynamoDb.get({
        TableName: TableNames.COMPANIES,
        Key: { companyId },
      });

      if (!companyResult.Item) {
        return notFound(`Company not found: ${companyId}`);
      }
    }

    // Fetch all existing wrestler names to skip duplicates
    const existingWrestlers = await dynamoDb.scanAll({
      TableName: TableNames.WRESTLERS,
      ProjectionExpression: '#n',
      ExpressionAttributeNames: { '#n': 'name' },
    });
    const existingNames = new Set(
      existingWrestlers.map((w) => (w.name as string).toLowerCase())
    );

    const errors: ImportError[] = [];
    const validItems: Record<string, unknown>[] = [];
    const seenNames = new Set<string>();
    let skipped = 0;
    const now = new Date().toISOString();

    for (let index = 0; index < wrestlers.length; index++) {
      const wrestler = wrestlers[index];
      const rawName = wrestler.name;

      // Validate name
      if (!rawName || typeof rawName !== 'string' || rawName.trim().length === 0) {
        errors.push({ index, name: rawName || '', reason: 'Name is required' });
        continue;
      }

      const trimmedName = rawName.trim();
      const lowerName = trimmedName.toLowerCase();

      // Skip wrestlers that already exist in the database
      if (existingNames.has(lowerName)) {
        skipped++;
        continue;
      }

      // Check for duplicate names within batch
      if (seenNames.has(lowerName)) {
        skipped++;
        continue;
      }

      // Validate alignment if provided
      if (wrestler.alignment && !VALID_ALIGNMENTS.includes(wrestler.alignment)) {
        errors.push({
          index,
          name: trimmedName,
          reason: `Invalid alignment: ${wrestler.alignment}. Must be face, heel, or tweener`,
        });
        continue;
      }

      seenNames.add(lowerName);

      const item: Record<string, unknown> = {
        wrestlerId: uuidv4(),
        name: trimmedName,
        wins: 0,
        losses: 0,
        draws: 0,
        createdAt: now,
        updatedAt: now,
      };

      if (wrestler.nickname) item.nickname = wrestler.nickname;
      if (wrestler.finisher) item.finisher = wrestler.finisher;
      if (wrestler.weight) item.weight = wrestler.weight;
      if (wrestler.height) item.height = wrestler.height;
      if (wrestler.hometown) item.hometown = wrestler.hometown;
      if (wrestler.alignment) item.alignment = wrestler.alignment;
      if (wrestler.imageUrl) item.imageUrl = wrestler.imageUrl;
      if (companyId) item.companyId = companyId;

      validItems.push(item);
    }

    // Batch write valid items
    if (validItems.length > 0) {
      await dynamoDb.batchWrite(TableNames.WRESTLERS, validItems);
    }

    return created({
      imported: validItems.length,
      failed: errors.length,
      skipped,
      total: wrestlers.length,
      errors,
    });
  } catch (err) {
    console.error('Failed to import wrestlers:', err);
    return serverError('Failed to import wrestlers');
  }
};
