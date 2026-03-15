import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEvent, Context, Callback } from 'aws-lambda';

const {
  mockGet,
  mockPut,
  mockScan,
  mockQuery,
  mockUpdate,
  mockDelete,
  mockScanAll,
  mockQueryAll,
} = vi.hoisted(() => ({
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

vi.mock('uuid', () => ({ v4: () => 'test-uuid-1234' }));

vi.mock('../../../lib/auth', () => ({
  requireRole: () => undefined,
  getAuthContext: () => ({ sub: 'user-sub-1', groups: ['Wrestler'], username: 'u', email: 'e@e.com' }),
  hasRole: () => true,
}));

import { handler } from '../handler';

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
    resource: '/wrestlers',
    requestContext: { authorizer: {} } as any,
    ...overrides,
  };
}

describe('wrestlers router', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET /wrestlers routes to getWrestlers and returns 200', async () => {
    mockScan.mockResolvedValue({ Items: [{ wrestlerId: 'p1', name: 'P1' }] });
    const event = makeEvent({
      httpMethod: 'GET',
      path: '/dev/wrestlers',
      resource: '/wrestlers',
      pathParameters: null,
    });
    const result = await handler(event, ctx, cb);
    expect(result!.statusCode).toBe(200);
    expect(JSON.parse(result!.body)).toHaveLength(1);
  });

  it('POST /wrestlers routes to createWrestler and returns 201', async () => {
    mockPut.mockResolvedValue({});
    const event = makeEvent({
      httpMethod: 'POST',
      path: '/dev/wrestlers',
      resource: '/wrestlers',
      pathParameters: null,
      body: JSON.stringify({ name: 'John' }),
    });
    const result = await handler(event, ctx, cb);
    expect(result!.statusCode).toBe(201);
    expect(JSON.parse(result!.body).wrestlerId).toBe('test-uuid-1234');
  });

  it('PUT /wrestlers/{wrestlerId} routes to updateWrestler', async () => {
    mockGet.mockResolvedValue({ Item: { wrestlerId: 'p1', name: 'Old' } });
    mockUpdate.mockResolvedValue({});
    const event = makeEvent({
      httpMethod: 'PUT',
      path: '/dev/wrestlers/p1',
      resource: '/wrestlers/{wrestlerId}',
      pathParameters: { wrestlerId: 'p1' },
      body: JSON.stringify({ name: 'New' }),
    });
    const result = await handler(event, ctx, cb);
    expect(result!.statusCode).toBe(200);
  });

  it('DELETE /wrestlers/{wrestlerId} routes to deleteWrestler', async () => {
    mockGet.mockResolvedValue({ Item: { wrestlerId: 'p1' } });
    mockScan.mockResolvedValue({ Items: [] });
    mockQuery.mockResolvedValue({ Items: [] });
    mockDelete.mockResolvedValue({});
    const event = makeEvent({
      httpMethod: 'DELETE',
      path: '/dev/wrestlers/p1',
      resource: '/wrestlers/{wrestlerId}',
      pathParameters: { wrestlerId: 'p1' },
    });
    const result = await handler(event, ctx, cb);
    expect(result!.statusCode).toBe(204);
  });

  it('returns 405 for unsupported method/path', async () => {
    const event = makeEvent({
      httpMethod: 'PATCH',
      path: '/dev/wrestlers',
      resource: '/wrestlers',
      pathParameters: null,
    });
    const result = await handler(event, ctx, cb);
    expect(result!.statusCode).toBe(405);
    expect(JSON.parse(result!.body).message).toBeDefined();
  });
});
