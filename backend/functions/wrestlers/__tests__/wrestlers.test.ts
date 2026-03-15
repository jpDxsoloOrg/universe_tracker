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
    WRESTLERS: 'Wrestlers',
    DIVISIONS: 'Divisions',
    CHAMPIONSHIPS: 'Championships',
    SEASON_STANDINGS: 'SeasonStandings',
    SEASONS: 'Seasons',
  },
}));

vi.mock('uuid', () => ({
  v4: () => 'test-uuid-1234',
}));

import { handler as createWrestler } from '../createWrestler';
import { handler as getWrestlers } from '../getWrestlers';
import { handler as updateWrestler } from '../updateWrestler';
import { handler as deleteWrestler } from '../deleteWrestler';

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
    requestContext: { authorizer: {} } as any,
    ...overrides,
  };
}

// ─── createWrestler ────────────────────────────────────────────────────

describe('createWrestler', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a wrestler with required fields and returns 201', async () => {
    mockPut.mockResolvedValue({});
    const event = makeEvent({
      body: JSON.stringify({ name: 'John Doe' }),
    });

    const result = await createWrestler(event, ctx, cb);

    expect(result!.statusCode).toBe(201);
    const body = JSON.parse(result!.body);
    expect(body.wrestlerId).toBe('test-uuid-1234');
    expect(body.name).toBe('John Doe');
    expect(body.wins).toBe(0);
    expect(body.losses).toBe(0);
    expect(body.draws).toBe(0);
    expect(mockPut).toHaveBeenCalledOnce();
  });

  it('returns 400 when name is missing', async () => {
    const event = makeEvent({
      body: JSON.stringify({}),
    });

    const result = await createWrestler(event, ctx, cb);

    expect(result!.statusCode).toBe(400);
    expect(JSON.parse(result!.body).message).toBe('name is required');
  });

  it('validates divisionId exists when provided', async () => {
    mockGet.mockResolvedValue({ Item: undefined });
    const event = makeEvent({
      body: JSON.stringify({ name: 'John', divisionId: 'bad-div' }),
    });

    const result = await createWrestler(event, ctx, cb);

    expect(result!.statusCode).toBe(404);
    expect(JSON.parse(result!.body).message).toContain('Division');
  });

  it('creates wrestler with valid divisionId', async () => {
    mockGet.mockResolvedValue({ Item: { divisionId: 'div-1', name: 'Raw' } });
    mockPut.mockResolvedValue({});
    const event = makeEvent({
      body: JSON.stringify({ name: 'John', divisionId: 'div-1' }),
    });

    const result = await createWrestler(event, ctx, cb);

    expect(result!.statusCode).toBe(201);
    expect(JSON.parse(result!.body).divisionId).toBe('div-1');
  });

  it('returns 400 for missing body', async () => {
    const event = makeEvent({ body: null });

    const result = await createWrestler(event, ctx, cb);

    expect(result!.statusCode).toBe(400);
  });
});

// ─── getWrestlers ──────────────────────────────────────────────────────

describe('getWrestlers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns all wrestlers with wrestlers assigned', async () => {
    mockScan.mockResolvedValue({
      Items: [
        { wrestlerId: '1', name: 'P1' },
        { wrestlerId: '2', name: 'P2' },
      ],
    });

    const result = await getWrestlers(makeEvent(), ctx, cb);

    expect(result!.statusCode).toBe(200);
    expect(JSON.parse(result!.body)).toHaveLength(2);
  });

  it('returns all wrestlers including those without optional fields', async () => {
    mockScan.mockResolvedValue({
      Items: [
        { wrestlerId: '1', name: 'P1' },
        { wrestlerId: '2', name: 'P2' },
      ],
    });

    const result = await getWrestlers(makeEvent(), ctx, cb);

    expect(result!.statusCode).toBe(200);
    expect(JSON.parse(result!.body)).toHaveLength(2);
  });

  it('returns empty array when no wrestlers exist', async () => {
    mockScan.mockResolvedValue({ Items: undefined });

    const result = await getWrestlers(makeEvent(), ctx, cb);

    expect(result!.statusCode).toBe(200);
    expect(JSON.parse(result!.body)).toEqual([]);
  });

  it('returns 500 when scan throws an error', async () => {
    mockScan.mockRejectedValue(new Error('DynamoDB failure'));

    const result = await getWrestlers(makeEvent(), ctx, cb);

    expect(result!.statusCode).toBe(500);
    expect(JSON.parse(result!.body).message).toBe('Failed to fetch wrestlers');
  });
});

// ─── updateWrestler ────────────────────────────────────────────────────

describe('updateWrestler', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates wrestler fields and returns updated wrestler', async () => {
    mockGet.mockResolvedValue({ Item: { wrestlerId: 'p1', name: 'Old Name' } });
    mockUpdate.mockResolvedValue({ Attributes: { wrestlerId: 'p1', name: 'New Name' } });

    const event = makeEvent({
      pathParameters: { wrestlerId: 'p1' },
      body: JSON.stringify({ name: 'New Name' }),
    });

    const result = await updateWrestler(event, ctx, cb);

    expect(result!.statusCode).toBe(200);
    expect(JSON.parse(result!.body).name).toBe('New Name');
  });

  it('returns 404 if wrestler does not exist', async () => {
    mockGet.mockResolvedValue({ Item: undefined });

    const event = makeEvent({
      pathParameters: { wrestlerId: 'missing' },
      body: JSON.stringify({ name: 'X' }),
    });

    const result = await updateWrestler(event, ctx, cb);

    expect(result!.statusCode).toBe(404);
  });

  it('returns 400 if wrestlerId is missing from path', async () => {
    const event = makeEvent({
      pathParameters: null,
      body: JSON.stringify({ name: 'X' }),
    });

    const result = await updateWrestler(event, ctx, cb);

    expect(result!.statusCode).toBe(400);
    expect(JSON.parse(result!.body).message).toBe('Wrestler ID is required');
  });

  it('returns 400 when no valid fields to update', async () => {
    mockGet.mockResolvedValue({ Item: { wrestlerId: 'p1' } });

    const event = makeEvent({
      pathParameters: { wrestlerId: 'p1' },
      body: JSON.stringify({}),
    });

    const result = await updateWrestler(event, ctx, cb);

    expect(result!.statusCode).toBe(400);
    expect(JSON.parse(result!.body).message).toBe('No valid fields to update');
  });

  it('removes divisionId when set to empty string', async () => {
    mockGet.mockResolvedValue({ Item: { wrestlerId: 'p1', divisionId: 'div-1' } });
    mockUpdate.mockResolvedValue({ Attributes: { wrestlerId: 'p1' } });

    const event = makeEvent({
      pathParameters: { wrestlerId: 'p1' },
      body: JSON.stringify({ divisionId: '' }),
    });

    const result = await updateWrestler(event, ctx, cb);

    expect(result!.statusCode).toBe(200);
    // Verify update was called with REMOVE expression
    const updateCall = mockUpdate.mock.calls[0][0];
    expect(updateCall.UpdateExpression).toContain('REMOVE');
  });

  it('updates name field', async () => {
    mockGet.mockResolvedValue({ Item: { wrestlerId: 'p1', name: 'Old Wrestler' } });
    mockUpdate.mockResolvedValue({ Attributes: { wrestlerId: 'p1', name: 'New Wrestler' } });

    const event = makeEvent({
      pathParameters: { wrestlerId: 'p1' },
      body: JSON.stringify({ name: 'New Wrestler' }),
    });

    const result = await updateWrestler(event, ctx, cb);

    expect(result!.statusCode).toBe(200);
    expect(JSON.parse(result!.body).name).toBe('New Wrestler');
    const updateCall = mockUpdate.mock.calls[0][0];
    expect(updateCall.UpdateExpression).toContain('#name');
  });

  it('updates imageUrl field', async () => {
    mockGet.mockResolvedValue({ Item: { wrestlerId: 'p1', name: 'John' } });
    mockUpdate.mockResolvedValue({ Attributes: { wrestlerId: 'p1', imageUrl: 'https://example.com/new.png' } });

    const event = makeEvent({
      pathParameters: { wrestlerId: 'p1' },
      body: JSON.stringify({ imageUrl: 'https://example.com/new.png' }),
    });

    const result = await updateWrestler(event, ctx, cb);

    expect(result!.statusCode).toBe(200);
    const updateCall = mockUpdate.mock.calls[0][0];
    expect(updateCall.UpdateExpression).toContain('#imageUrl');
  });

  it('updates divisionId with valid division (validates existence)', async () => {
    mockGet
      .mockResolvedValueOnce({ Item: { wrestlerId: 'p1', name: 'John' } })
      .mockResolvedValueOnce({ Item: { divisionId: 'div-1', name: 'Raw' } });
    mockUpdate.mockResolvedValue({ Attributes: { wrestlerId: 'p1', divisionId: 'div-1' } });

    const event = makeEvent({
      pathParameters: { wrestlerId: 'p1' },
      body: JSON.stringify({ divisionId: 'div-1' }),
    });

    const result = await updateWrestler(event, ctx, cb);

    expect(result!.statusCode).toBe(200);
    const updateCall = mockUpdate.mock.calls[0][0];
    expect(updateCall.UpdateExpression).toContain('SET');
    expect(updateCall.UpdateExpression).toContain('#divisionId');
    expect(updateCall.UpdateExpression).not.toMatch(/REMOVE\s.*#divisionId/);
  });

  it('returns 404 when divisionId references non-existent division', async () => {
    mockGet
      .mockResolvedValueOnce({ Item: { wrestlerId: 'p1', name: 'John' } })
      .mockResolvedValueOnce({ Item: undefined });

    const event = makeEvent({
      pathParameters: { wrestlerId: 'p1' },
      body: JSON.stringify({ divisionId: 'bad-div' }),
    });

    const result = await updateWrestler(event, ctx, cb);

    expect(result!.statusCode).toBe(404);
    expect(JSON.parse(result!.body).message).toContain('Division');
  });

  it('returns 500 when an unexpected error occurs', async () => {
    mockGet.mockRejectedValue(new Error('DynamoDB failure'));

    const event = makeEvent({
      pathParameters: { wrestlerId: 'p1' },
      body: JSON.stringify({ name: 'X' }),
    });

    const result = await updateWrestler(event, ctx, cb);

    expect(result!.statusCode).toBe(500);
    expect(JSON.parse(result!.body).message).toBe('Failed to update wrestler');
  });
});

// ─── deleteWrestler ────────────────────────────────────────────────────

describe('deleteWrestler', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes wrestler and returns 204', async () => {
    mockGet.mockResolvedValue({ Item: { wrestlerId: 'p1', name: 'John' } });
    mockScan.mockResolvedValue({ Items: [] }); // no championships
    mockDelete.mockResolvedValue({});
    mockQuery.mockResolvedValue({ Items: [] }); // no standings

    const event = makeEvent({ pathParameters: { wrestlerId: 'p1' } });

    const result = await deleteWrestler(event, ctx, cb);

    expect(result!.statusCode).toBe(204);
    expect(mockDelete).toHaveBeenCalled();
  });

  it('returns 404 if wrestler not found', async () => {
    mockGet.mockResolvedValue({ Item: undefined });

    const event = makeEvent({ pathParameters: { wrestlerId: 'missing' } });

    const result = await deleteWrestler(event, ctx, cb);

    expect(result!.statusCode).toBe(404);
  });

  it('returns 409 if wrestler is a current champion', async () => {
    mockGet.mockResolvedValue({ Item: { wrestlerId: 'p1' } });
    mockScan.mockResolvedValue({
      Items: [{ name: 'World Championship', currentChampion: 'p1' }],
    });

    const event = makeEvent({ pathParameters: { wrestlerId: 'p1' } });

    const result = await deleteWrestler(event, ctx, cb);

    expect(result!.statusCode).toBe(409);
    expect(JSON.parse(result!.body).message).toContain('World Championship');
  });

  it('returns 400 if wrestlerId is missing', async () => {
    const event = makeEvent({ pathParameters: null });

    const result = await deleteWrestler(event, ctx, cb);

    expect(result!.statusCode).toBe(400);
  });

  it('cleans up season standings on delete', async () => {
    mockGet.mockResolvedValue({ Item: { wrestlerId: 'p1' } });
    mockScan.mockResolvedValue({ Items: [] });
    mockDelete.mockResolvedValue({});
    mockQuery.mockResolvedValue({
      Items: [
        { seasonId: 's1', wrestlerId: 'p1' },
        { seasonId: 's2', wrestlerId: 'p1' },
      ],
    });

    const event = makeEvent({ pathParameters: { wrestlerId: 'p1' } });

    await deleteWrestler(event, ctx, cb);

    // 1 wrestler delete + 2 standings deletes = 3 total
    expect(mockDelete).toHaveBeenCalledTimes(3);
  });
});
