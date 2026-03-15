import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEvent, Context, Callback } from 'aws-lambda';

// ─── Mocks ───────────────────────────────────────────────────────────

const { mockGet, mockPut, mockScan, mockQuery, mockUpdate, mockDelete, mockScanAll, mockQueryAll } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPut: vi.fn(),
  mockScan: vi.fn(),
  mockQuery: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockScanAll: vi.fn(),
  mockQueryAll: vi.fn(),
}));

vi.mock('../../../lib/dynamodb', () => ({
  dynamoDb: {
    get: mockGet,
    put: mockPut,
    scan: mockScan,
    query: mockQuery,
    update: mockUpdate,
    delete: mockDelete,
    scanAll: mockScanAll,
    queryAll: mockQueryAll,
  },
  TableNames: {
    COMPANIES: 'Companies',
    WRESTLERS: 'Wrestlers',
    SHOWS: 'Shows',
  },
}));

vi.mock('uuid', () => ({
  v4: () => 'test-uuid-1234',
}));

import { handler as getCompanies } from '../getCompanies';
import { handler as getCompany } from '../getCompany';
import { handler as createCompany } from '../createCompany';
import { handler as updateCompany } from '../updateCompany';
import { handler as deleteCompany } from '../deleteCompany';

// ─── Helpers ─────────────────────────────────────────────────────────

const ctx = {} as Context;
const cb: Callback = () => {};

function makeEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    body: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'GET',
    isBase64Encoded: false,
    path: '/',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    resource: '',
    requestContext: { authorizer: {} } as APIGatewayProxyEvent['requestContext'],
    ...overrides,
  };
}

// ─── getCompanies ────────────────────────────────────────────────────

describe('getCompanies', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns all companies sorted by name', async () => {
    mockScan.mockResolvedValue({
      Items: [
        { companyId: 'c-2', name: 'WWE' },
        { companyId: 'c-1', name: 'AEW' },
      ],
    });

    const result = await getCompanies(makeEvent(), ctx, cb);

    expect(result!.statusCode).toBe(200);
    const body = JSON.parse(result!.body);
    expect(body).toHaveLength(2);
    expect(body[0].name).toBe('AEW');
    expect(body[1].name).toBe('WWE');
    expect(mockScan).toHaveBeenCalledWith({ TableName: 'Companies' });
  });

  it('returns empty array when no companies exist', async () => {
    mockScan.mockResolvedValue({ Items: undefined });

    const result = await getCompanies(makeEvent(), ctx, cb);

    expect(result!.statusCode).toBe(200);
    expect(JSON.parse(result!.body)).toEqual([]);
  });

  it('returns 500 on DynamoDB error', async () => {
    mockScan.mockRejectedValue(new Error('DynamoDB failure'));

    const result = await getCompanies(makeEvent(), ctx, cb);

    expect(result!.statusCode).toBe(500);
    expect(JSON.parse(result!.body).message).toBe('Failed to fetch companies');
  });
});

// ─── getCompany ──────────────────────────────────────────────────────

describe('getCompany', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a company by ID', async () => {
    mockGet.mockResolvedValue({ Item: { companyId: 'c-1', name: 'WWE' } });

    const result = await getCompany(
      makeEvent({ pathParameters: { companyId: 'c-1' } }),
      ctx,
      cb
    );

    expect(result!.statusCode).toBe(200);
    expect(JSON.parse(result!.body).name).toBe('WWE');
  });

  it('returns 400 when companyId is missing', async () => {
    const result = await getCompany(makeEvent({ pathParameters: null }), ctx, cb);

    expect(result!.statusCode).toBe(400);
    expect(JSON.parse(result!.body).message).toBe('Company ID is required');
  });

  it('returns 404 when company not found', async () => {
    mockGet.mockResolvedValue({ Item: undefined });

    const result = await getCompany(
      makeEvent({ pathParameters: { companyId: 'nonexistent' } }),
      ctx,
      cb
    );

    expect(result!.statusCode).toBe(404);
    expect(JSON.parse(result!.body).message).toBe('Company not found');
  });

  it('returns 500 on DynamoDB error', async () => {
    mockGet.mockRejectedValue(new Error('DynamoDB failure'));

    const result = await getCompany(
      makeEvent({ pathParameters: { companyId: 'c-1' } }),
      ctx,
      cb
    );

    expect(result!.statusCode).toBe(500);
    expect(JSON.parse(result!.body).message).toBe('Failed to fetch company');
  });
});

// ─── createCompany ──────────────────────────────────────────────────

describe('createCompany', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a company with name only and returns 201', async () => {
    mockPut.mockResolvedValue({});
    const event = makeEvent({ body: JSON.stringify({ name: 'WWE' }) });

    const result = await createCompany(event, ctx, cb);

    expect(result!.statusCode).toBe(201);
    const body = JSON.parse(result!.body);
    expect(body.companyId).toBe('test-uuid-1234');
    expect(body.name).toBe('WWE');
    expect(body.createdAt).toBeDefined();
    expect(body.updatedAt).toBeDefined();
    expect(mockPut).toHaveBeenCalledOnce();
  });

  it('creates a company with all optional fields', async () => {
    mockPut.mockResolvedValue({});
    const event = makeEvent({
      body: JSON.stringify({
        name: 'WWE',
        abbreviation: 'WWE',
        imageUrl: 'https://example.com/wwe.png',
        description: 'World Wrestling Entertainment',
      }),
    });

    const result = await createCompany(event, ctx, cb);

    expect(result!.statusCode).toBe(201);
    const body = JSON.parse(result!.body);
    expect(body.name).toBe('WWE');
    expect(body.abbreviation).toBe('WWE');
    expect(body.imageUrl).toBe('https://example.com/wwe.png');
    expect(body.description).toBe('World Wrestling Entertainment');
  });

  it('returns 400 when name is missing', async () => {
    const event = makeEvent({ body: JSON.stringify({ abbreviation: 'WWE' }) });

    const result = await createCompany(event, ctx, cb);

    expect(result!.statusCode).toBe(400);
    expect(JSON.parse(result!.body).message).toBe('name is required');
  });

  it('returns 400 when body is null', async () => {
    const result = await createCompany(makeEvent({ body: null }), ctx, cb);

    expect(result!.statusCode).toBe(400);
    expect(JSON.parse(result!.body).message).toBe('Request body is required');
  });

  it('returns 400 when body is malformed JSON', async () => {
    const result = await createCompany(makeEvent({ body: '{bad json' }), ctx, cb);

    expect(result!.statusCode).toBe(400);
    expect(JSON.parse(result!.body).message).toBe('Invalid JSON in request body');
  });

  it('returns 500 on DynamoDB error', async () => {
    mockPut.mockRejectedValue(new Error('DynamoDB failure'));
    const event = makeEvent({ body: JSON.stringify({ name: 'WWE' }) });

    const result = await createCompany(event, ctx, cb);

    expect(result!.statusCode).toBe(500);
    expect(JSON.parse(result!.body).message).toBe('Failed to create company');
  });
});

// ─── updateCompany ──────────────────────────────────────────────────

describe('updateCompany', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates company name and returns updated record', async () => {
    mockGet.mockResolvedValue({ Item: { companyId: 'c-1', name: 'WWE' } });
    mockUpdate.mockResolvedValue({
      Attributes: { companyId: 'c-1', name: 'WWE Updated', updatedAt: '2024-01-01' },
    });

    const event = makeEvent({
      pathParameters: { companyId: 'c-1' },
      body: JSON.stringify({ name: 'WWE Updated' }),
    });

    const result = await updateCompany(event, ctx, cb);

    expect(result!.statusCode).toBe(200);
    expect(JSON.parse(result!.body).name).toBe('WWE Updated');
    expect(mockUpdate).toHaveBeenCalledOnce();
  });

  it('returns 400 when companyId is missing from path', async () => {
    const event = makeEvent({
      pathParameters: null,
      body: JSON.stringify({ name: 'X' }),
    });

    const result = await updateCompany(event, ctx, cb);

    expect(result!.statusCode).toBe(400);
    expect(JSON.parse(result!.body).message).toBe('Company ID is required');
  });

  it('returns 404 when company does not exist', async () => {
    mockGet.mockResolvedValue({ Item: undefined });

    const event = makeEvent({
      pathParameters: { companyId: 'nonexistent' },
      body: JSON.stringify({ name: 'X' }),
    });

    const result = await updateCompany(event, ctx, cb);

    expect(result!.statusCode).toBe(404);
    expect(JSON.parse(result!.body).message).toBe('Company not found');
  });

  it('returns 500 on DynamoDB error', async () => {
    mockGet.mockResolvedValue({ Item: { companyId: 'c-1' } });
    mockUpdate.mockRejectedValue(new Error('DynamoDB failure'));

    const event = makeEvent({
      pathParameters: { companyId: 'c-1' },
      body: JSON.stringify({ name: 'X' }),
    });

    const result = await updateCompany(event, ctx, cb);

    expect(result!.statusCode).toBe(500);
    expect(JSON.parse(result!.body).message).toBe('Failed to update company');
  });
});

// ─── deleteCompany ──────────────────────────────────────────────────

describe('deleteCompany', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes company and returns 204', async () => {
    mockGet.mockResolvedValue({ Item: { companyId: 'c-1', name: 'WWE' } });
    mockScan.mockResolvedValue({ Items: [] });
    mockQuery.mockResolvedValue({ Items: [] });
    mockDelete.mockResolvedValue({});

    const event = makeEvent({ pathParameters: { companyId: 'c-1' } });

    const result = await deleteCompany(event, ctx, cb);

    expect(result!.statusCode).toBe(204);
    expect(mockDelete).toHaveBeenCalledWith({
      TableName: 'Companies',
      Key: { companyId: 'c-1' },
    });
  });

  it('returns 400 when companyId is missing from path', async () => {
    const result = await deleteCompany(makeEvent({ pathParameters: null }), ctx, cb);

    expect(result!.statusCode).toBe(400);
    expect(JSON.parse(result!.body).message).toBe('Company ID is required');
  });

  it('returns 404 when company does not exist', async () => {
    mockGet.mockResolvedValue({ Item: undefined });

    const event = makeEvent({ pathParameters: { companyId: 'nonexistent' } });

    const result = await deleteCompany(event, ctx, cb);

    expect(result!.statusCode).toBe(404);
    expect(JSON.parse(result!.body).message).toBe('Company not found');
  });

  it('returns 409 when wrestlers are assigned to the company', async () => {
    mockGet.mockResolvedValue({ Item: { companyId: 'c-1', name: 'WWE' } });
    mockScan.mockResolvedValue({
      Items: [
        { wrestlerId: 'w1', name: 'John Cena', companyId: 'c-1' },
      ],
    });

    const event = makeEvent({ pathParameters: { companyId: 'c-1' } });

    const result = await deleteCompany(event, ctx, cb);

    expect(result!.statusCode).toBe(409);
    expect(JSON.parse(result!.body).message).toContain('1 wrestler(s)');
    expect(JSON.parse(result!.body).message).toContain('Cannot delete company');
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('returns 409 when shows are assigned to the company', async () => {
    mockGet.mockResolvedValue({ Item: { companyId: 'c-1', name: 'WWE' } });
    mockScan.mockResolvedValue({ Items: [] });
    mockQuery.mockResolvedValue({
      Items: [
        { showId: 's1', name: 'Raw', companyId: 'c-1' },
        { showId: 's2', name: 'SmackDown', companyId: 'c-1' },
      ],
    });

    const event = makeEvent({ pathParameters: { companyId: 'c-1' } });

    const result = await deleteCompany(event, ctx, cb);

    expect(result!.statusCode).toBe(409);
    expect(JSON.parse(result!.body).message).toContain('2 show(s)');
    expect(JSON.parse(result!.body).message).toContain('Cannot delete company');
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('returns 500 on DynamoDB error', async () => {
    mockGet.mockRejectedValue(new Error('DynamoDB failure'));

    const event = makeEvent({ pathParameters: { companyId: 'c-1' } });

    const result = await deleteCompany(event, ctx, cb);

    expect(result!.statusCode).toBe(500);
    expect(JSON.parse(result!.body).message).toBe('Failed to delete company');
  });
});
