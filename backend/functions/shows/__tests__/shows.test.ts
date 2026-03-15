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
    SHOWS: 'Shows',
    COMPANIES: 'Companies',
    EVENTS: 'Events',
  },
}));

vi.mock('uuid', () => ({
  v4: () => 'test-uuid-5678',
}));

import { handler as getShows } from '../getShows';
import { handler as getShow } from '../getShow';
import { handler as createShow } from '../createShow';
import { handler as updateShow } from '../updateShow';
import { handler as deleteShow } from '../deleteShow';

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

// ─── getShows ────────────────────────────────────────────────────────

describe('getShows', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns all shows sorted by name when no companyId filter', async () => {
    mockScan.mockResolvedValue({
      Items: [
        { showId: 's-2', name: 'SmackDown', companyId: 'c-1' },
        { showId: 's-1', name: 'Raw', companyId: 'c-1' },
      ],
    });

    const result = await getShows(makeEvent(), ctx, cb);

    expect(result!.statusCode).toBe(200);
    const body = JSON.parse(result!.body);
    expect(body).toHaveLength(2);
    expect(body[0].name).toBe('Raw');
    expect(body[1].name).toBe('SmackDown');
    expect(mockScan).toHaveBeenCalledWith({ TableName: 'Shows' });
  });

  it('queries by companyId when filter provided', async () => {
    mockQuery.mockResolvedValue({
      Items: [
        { showId: 's-1', name: 'Raw', companyId: 'c-1' },
      ],
    });

    const result = await getShows(
      makeEvent({ queryStringParameters: { companyId: 'c-1' } }),
      ctx,
      cb
    );

    expect(result!.statusCode).toBe(200);
    const body = JSON.parse(result!.body);
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('Raw');
    expect(mockQuery).toHaveBeenCalledWith({
      TableName: 'Shows',
      IndexName: 'CompanyShowsIndex',
      KeyConditionExpression: '#companyId = :companyId',
      ExpressionAttributeNames: { '#companyId': 'companyId' },
      ExpressionAttributeValues: { ':companyId': 'c-1' },
    });
  });

  it('returns empty array when no shows exist', async () => {
    mockScan.mockResolvedValue({ Items: undefined });

    const result = await getShows(makeEvent(), ctx, cb);

    expect(result!.statusCode).toBe(200);
    expect(JSON.parse(result!.body)).toEqual([]);
  });

  it('returns 500 on DynamoDB error', async () => {
    mockScan.mockRejectedValue(new Error('DynamoDB failure'));

    const result = await getShows(makeEvent(), ctx, cb);

    expect(result!.statusCode).toBe(500);
    expect(JSON.parse(result!.body).message).toBe('Failed to fetch shows');
  });
});

// ─── getShow ─────────────────────────────────────────────────────────

describe('getShow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a show by ID', async () => {
    mockGet.mockResolvedValue({ Item: { showId: 's-1', name: 'Raw', companyId: 'c-1' } });

    const result = await getShow(
      makeEvent({ pathParameters: { showId: 's-1' } }),
      ctx,
      cb
    );

    expect(result!.statusCode).toBe(200);
    expect(JSON.parse(result!.body).name).toBe('Raw');
  });

  it('returns 400 when showId is missing', async () => {
    const result = await getShow(makeEvent({ pathParameters: null }), ctx, cb);

    expect(result!.statusCode).toBe(400);
    expect(JSON.parse(result!.body).message).toBe('Show ID is required');
  });

  it('returns 404 when show not found', async () => {
    mockGet.mockResolvedValue({ Item: undefined });

    const result = await getShow(
      makeEvent({ pathParameters: { showId: 'nonexistent' } }),
      ctx,
      cb
    );

    expect(result!.statusCode).toBe(404);
    expect(JSON.parse(result!.body).message).toBe('Show not found');
  });

  it('returns 500 on DynamoDB error', async () => {
    mockGet.mockRejectedValue(new Error('DynamoDB failure'));

    const result = await getShow(
      makeEvent({ pathParameters: { showId: 's-1' } }),
      ctx,
      cb
    );

    expect(result!.statusCode).toBe(500);
    expect(JSON.parse(result!.body).message).toBe('Failed to fetch show');
  });
});

// ─── createShow ─────────────────────────────────────────────────────

describe('createShow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a show and returns 201', async () => {
    mockGet.mockResolvedValue({ Item: { companyId: 'c-1', name: 'WWE' } });
    mockPut.mockResolvedValue({});

    const event = makeEvent({
      body: JSON.stringify({ name: 'Raw', companyId: 'c-1' }),
    });

    const result = await createShow(event, ctx, cb);

    expect(result!.statusCode).toBe(201);
    const body = JSON.parse(result!.body);
    expect(body.showId).toBe('test-uuid-5678');
    expect(body.name).toBe('Raw');
    expect(body.companyId).toBe('c-1');
    expect(body.createdAt).toBeDefined();
    expect(mockPut).toHaveBeenCalledOnce();
  });

  it('creates a show with optional fields', async () => {
    mockGet.mockResolvedValue({ Item: { companyId: 'c-1', name: 'WWE' } });
    mockPut.mockResolvedValue({});

    const event = makeEvent({
      body: JSON.stringify({
        name: 'Raw',
        companyId: 'c-1',
        description: 'Monday Night Raw',
        schedule: 'weekly',
      }),
    });

    const result = await createShow(event, ctx, cb);

    expect(result!.statusCode).toBe(201);
    const body = JSON.parse(result!.body);
    expect(body.description).toBe('Monday Night Raw');
    expect(body.schedule).toBe('weekly');
  });

  it('returns 400 when name is missing', async () => {
    const event = makeEvent({ body: JSON.stringify({ companyId: 'c-1' }) });

    const result = await createShow(event, ctx, cb);

    expect(result!.statusCode).toBe(400);
    expect(JSON.parse(result!.body).message).toBe('name is required');
  });

  it('returns 400 when companyId is missing', async () => {
    const event = makeEvent({ body: JSON.stringify({ name: 'Raw' }) });

    const result = await createShow(event, ctx, cb);

    expect(result!.statusCode).toBe(400);
    expect(JSON.parse(result!.body).message).toBe('companyId is required');
  });

  it('returns 404 when company does not exist', async () => {
    mockGet.mockResolvedValue({ Item: undefined });

    const event = makeEvent({
      body: JSON.stringify({ name: 'Raw', companyId: 'nonexistent' }),
    });

    const result = await createShow(event, ctx, cb);

    expect(result!.statusCode).toBe(404);
    expect(JSON.parse(result!.body).message).toContain('Company');
    expect(JSON.parse(result!.body).message).toContain('not found');
  });

  it('returns 400 when body is null', async () => {
    const result = await createShow(makeEvent({ body: null }), ctx, cb);

    expect(result!.statusCode).toBe(400);
    expect(JSON.parse(result!.body).message).toBe('Request body is required');
  });

  it('returns 500 on DynamoDB error', async () => {
    mockGet.mockResolvedValue({ Item: { companyId: 'c-1', name: 'WWE' } });
    mockPut.mockRejectedValue(new Error('DynamoDB failure'));

    const event = makeEvent({
      body: JSON.stringify({ name: 'Raw', companyId: 'c-1' }),
    });

    const result = await createShow(event, ctx, cb);

    expect(result!.statusCode).toBe(500);
    expect(JSON.parse(result!.body).message).toBe('Failed to create show');
  });
});

// ─── updateShow ─────────────────────────────────────────────────────

describe('updateShow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates show name and returns updated record', async () => {
    mockGet.mockResolvedValue({ Item: { showId: 's-1', name: 'Raw', companyId: 'c-1' } });
    mockUpdate.mockResolvedValue({
      Attributes: { showId: 's-1', name: 'Raw Updated', updatedAt: '2024-01-01' },
    });

    const event = makeEvent({
      pathParameters: { showId: 's-1' },
      body: JSON.stringify({ name: 'Raw Updated' }),
    });

    const result = await updateShow(event, ctx, cb);

    expect(result!.statusCode).toBe(200);
    expect(JSON.parse(result!.body).name).toBe('Raw Updated');
    expect(mockUpdate).toHaveBeenCalledOnce();
  });

  it('validates new companyId when changing company', async () => {
    // First call: getOrNotFound for the show
    // Second call: validate new company exists
    mockGet
      .mockResolvedValueOnce({ Item: { showId: 's-1', name: 'Raw', companyId: 'c-1' } })
      .mockResolvedValueOnce({ Item: undefined });

    const event = makeEvent({
      pathParameters: { showId: 's-1' },
      body: JSON.stringify({ companyId: 'nonexistent' }),
    });

    const result = await updateShow(event, ctx, cb);

    expect(result!.statusCode).toBe(404);
    expect(JSON.parse(result!.body).message).toContain('Company');
    expect(JSON.parse(result!.body).message).toContain('not found');
  });

  it('returns 400 when showId is missing from path', async () => {
    const event = makeEvent({
      pathParameters: null,
      body: JSON.stringify({ name: 'X' }),
    });

    const result = await updateShow(event, ctx, cb);

    expect(result!.statusCode).toBe(400);
    expect(JSON.parse(result!.body).message).toBe('Show ID is required');
  });

  it('returns 404 when show does not exist', async () => {
    mockGet.mockResolvedValue({ Item: undefined });

    const event = makeEvent({
      pathParameters: { showId: 'nonexistent' },
      body: JSON.stringify({ name: 'X' }),
    });

    const result = await updateShow(event, ctx, cb);

    expect(result!.statusCode).toBe(404);
    expect(JSON.parse(result!.body).message).toBe('Show not found');
  });

  it('returns 500 on DynamoDB error', async () => {
    mockGet.mockResolvedValue({ Item: { showId: 's-1' } });
    mockUpdate.mockRejectedValue(new Error('DynamoDB failure'));

    const event = makeEvent({
      pathParameters: { showId: 's-1' },
      body: JSON.stringify({ name: 'X' }),
    });

    const result = await updateShow(event, ctx, cb);

    expect(result!.statusCode).toBe(500);
    expect(JSON.parse(result!.body).message).toBe('Failed to update show');
  });
});

// ─── deleteShow ─────────────────────────────────────────────────────

describe('deleteShow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes show and returns 204', async () => {
    mockGet.mockResolvedValue({ Item: { showId: 's-1', name: 'Raw' } });
    mockScan.mockResolvedValue({ Items: [] });
    mockDelete.mockResolvedValue({});

    const event = makeEvent({ pathParameters: { showId: 's-1' } });

    const result = await deleteShow(event, ctx, cb);

    expect(result!.statusCode).toBe(204);
    expect(mockDelete).toHaveBeenCalledWith({
      TableName: 'Shows',
      Key: { showId: 's-1' },
    });
  });

  it('returns 400 when showId is missing from path', async () => {
    const result = await deleteShow(makeEvent({ pathParameters: null }), ctx, cb);

    expect(result!.statusCode).toBe(400);
    expect(JSON.parse(result!.body).message).toBe('Show ID is required');
  });

  it('returns 404 when show does not exist', async () => {
    mockGet.mockResolvedValue({ Item: undefined });

    const event = makeEvent({ pathParameters: { showId: 'nonexistent' } });

    const result = await deleteShow(event, ctx, cb);

    expect(result!.statusCode).toBe(404);
    expect(JSON.parse(result!.body).message).toBe('Show not found');
  });

  it('returns 409 when events reference this show', async () => {
    mockGet.mockResolvedValue({ Item: { showId: 's-1', name: 'Raw' } });
    mockScan.mockResolvedValue({
      Items: [
        { eventId: 'e1', name: 'Raw Episode 1', showId: 's-1' },
      ],
    });

    const event = makeEvent({ pathParameters: { showId: 's-1' } });

    const result = await deleteShow(event, ctx, cb);

    expect(result!.statusCode).toBe(409);
    expect(JSON.parse(result!.body).message).toContain('1 event(s)');
    expect(JSON.parse(result!.body).message).toContain('Cannot delete show');
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('deletes when events scan returns undefined Items', async () => {
    mockGet.mockResolvedValue({ Item: { showId: 's-1', name: 'Raw' } });
    mockScan.mockResolvedValue({ Items: undefined });
    mockDelete.mockResolvedValue({});

    const event = makeEvent({ pathParameters: { showId: 's-1' } });

    const result = await deleteShow(event, ctx, cb);

    expect(result!.statusCode).toBe(204);
    expect(mockDelete).toHaveBeenCalledOnce();
  });

  it('returns 500 on DynamoDB error', async () => {
    mockGet.mockRejectedValue(new Error('DynamoDB failure'));

    const event = makeEvent({ pathParameters: { showId: 's-1' } });

    const result = await deleteShow(event, ctx, cb);

    expect(result!.statusCode).toBe(500);
    expect(JSON.parse(result!.body).message).toBe('Failed to delete show');
  });
});
