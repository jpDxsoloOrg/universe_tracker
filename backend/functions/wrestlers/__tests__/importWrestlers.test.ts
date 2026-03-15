import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEvent, Context, Callback } from 'aws-lambda';

// ---- Mocks ----------------------------------------------------------------

const { mockGet, mockPut, mockBatchWrite } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPut: vi.fn(),
  mockBatchWrite: vi.fn(),
}));

vi.mock('../../../lib/dynamodb', () => ({
  dynamoDb: {
    get: mockGet,
    put: mockPut,
    scan: vi.fn(),
    query: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    scanAll: vi.fn(),
    queryAll: vi.fn(),
    transactWrite: vi.fn(),
    batchWrite: mockBatchWrite,
  },
  TableNames: {
    MATCHES: 'Matches',
    WRESTLERS: 'Wrestlers',
    CHAMPIONSHIPS: 'Championships',
    TOURNAMENTS: 'Tournaments',
    SEASONS: 'Seasons',
    EVENTS: 'Events',
    STIPULATIONS: 'Stipulations',
    COMPANIES: 'Companies',
    SHOWS: 'Shows',
  },
}));

vi.mock('uuid', () => ({
  v4: () => 'test-uuid',
}));

import { handler as importWrestlers } from '../importWrestlers';

// ---- Helpers ---------------------------------------------------------------

const ctx = {} as Context;
const cb: Callback = () => {};

function ev(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    body: null, headers: {}, multiValueHeaders: {}, httpMethod: 'POST',
    isBase64Encoded: false, path: '/', pathParameters: null,
    queryStringParameters: null, multiValueQueryStringParameters: null,
    stageVariables: null, resource: '', requestContext: { authorizer: {} } as unknown as APIGatewayProxyEvent['requestContext'],
    ...overrides,
  };
}

// ---- Tests -----------------------------------------------------------------

describe('importWrestlers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('imports valid wrestlers and returns 201', async () => {
    mockBatchWrite.mockResolvedValue(undefined);
    const body = JSON.stringify({
      wrestlers: [
        { name: 'Stone Cold Steve Austin', alignment: 'face' },
        { name: 'The Rock', alignment: 'heel' },
      ],
    });

    const r = await importWrestlers(ev({ body }), ctx, cb);
    expect(r!.statusCode).toBe(201);

    const b = JSON.parse(r!.body);
    expect(b.imported).toBe(2);
    expect(b.failed).toBe(0);
    expect(b.total).toBe(2);
    expect(b.errors).toEqual([]);
    expect(mockBatchWrite).toHaveBeenCalledOnce();
    expect(mockBatchWrite).toHaveBeenCalledWith('Wrestlers', expect.arrayContaining([
      expect.objectContaining({ name: 'Stone Cold Steve Austin', alignment: 'face', wins: 0, losses: 0, draws: 0 }),
      expect.objectContaining({ name: 'The Rock', alignment: 'heel' }),
    ]));
  });

  it('returns 400 when body is null', async () => {
    const r = await importWrestlers(ev({ body: null }), ctx, cb);
    expect(r!.statusCode).toBe(400);
    expect(JSON.parse(r!.body).message).toBe('Request body is required');
  });

  it('returns 400 when wrestlers is not an array', async () => {
    const r = await importWrestlers(ev({ body: JSON.stringify({ wrestlers: 'not-array' }) }), ctx, cb);
    expect(r!.statusCode).toBe(400);
    expect(JSON.parse(r!.body).message).toContain('must be an array');
  });

  it('returns 400 when wrestlers array is empty', async () => {
    const r = await importWrestlers(ev({ body: JSON.stringify({ wrestlers: [] }) }), ctx, cb);
    expect(r!.statusCode).toBe(400);
    expect(JSON.parse(r!.body).message).toContain('must not be empty');
  });

  it('returns 400 when wrestlers exceeds 500', async () => {
    const wrestlers = Array(501).fill({ name: 'x' }) as Array<{ name: string }>;
    const r = await importWrestlers(ev({ body: JSON.stringify({ wrestlers }) }), ctx, cb);
    expect(r!.statusCode).toBe(400);
    expect(JSON.parse(r!.body).message).toContain('must not exceed 500');
  });

  it('handles wrestlers with missing name as partial failure', async () => {
    mockBatchWrite.mockResolvedValue(undefined);
    const body = JSON.stringify({
      wrestlers: [
        { name: 'Valid Wrestler' },
        { name: '' },
        { name: 'Another Valid' },
        {},
      ],
    });

    const r = await importWrestlers(ev({ body }), ctx, cb);
    expect(r!.statusCode).toBe(201);

    const b = JSON.parse(r!.body);
    expect(b.imported).toBe(2);
    expect(b.failed).toBe(2);
    expect(b.total).toBe(4);
    expect(b.errors).toHaveLength(2);
    expect(b.errors[0].index).toBe(1);
    expect(b.errors[0].reason).toContain('Name is required');
    expect(b.errors[1].index).toBe(3);
  });

  it('handles duplicate names in batch as errors', async () => {
    mockBatchWrite.mockResolvedValue(undefined);
    const body = JSON.stringify({
      wrestlers: [
        { name: 'John Cena' },
        { name: 'john cena' },
        { name: 'The Undertaker' },
      ],
    });

    const r = await importWrestlers(ev({ body }), ctx, cb);
    expect(r!.statusCode).toBe(201);

    const b = JSON.parse(r!.body);
    expect(b.imported).toBe(2);
    expect(b.failed).toBe(1);
    expect(b.errors).toHaveLength(1);
    expect(b.errors[0].index).toBe(1);
    expect(b.errors[0].name).toBe('john cena');
    expect(b.errors[0].reason).toContain('Duplicate name');
  });

  it('handles invalid alignment as error', async () => {
    mockBatchWrite.mockResolvedValue(undefined);
    const body = JSON.stringify({
      wrestlers: [
        { name: 'Good Wrestler', alignment: 'face' },
        { name: 'Bad Alignment', alignment: 'badvalue' },
      ],
    });

    const r = await importWrestlers(ev({ body }), ctx, cb);
    expect(r!.statusCode).toBe(201);

    const b = JSON.parse(r!.body);
    expect(b.imported).toBe(1);
    expect(b.failed).toBe(1);
    expect(b.errors[0].index).toBe(1);
    expect(b.errors[0].name).toBe('Bad Alignment');
    expect(b.errors[0].reason).toContain('Invalid alignment');
  });

  it('validates companyId exists when provided', async () => {
    mockGet.mockResolvedValue({ Item: { companyId: 'comp-1', name: 'WWE' } });
    mockBatchWrite.mockResolvedValue(undefined);
    const body = JSON.stringify({
      wrestlers: [{ name: 'Test Wrestler' }],
      companyId: 'comp-1',
    });

    const r = await importWrestlers(ev({ body }), ctx, cb);
    expect(r!.statusCode).toBe(201);

    expect(mockGet).toHaveBeenCalledWith(
      expect.objectContaining({ TableName: 'Companies', Key: { companyId: 'comp-1' } })
    );
    expect(mockBatchWrite).toHaveBeenCalledWith('Wrestlers', [
      expect.objectContaining({ companyId: 'comp-1', name: 'Test Wrestler' }),
    ]);
  });

  it('returns 404 when companyId does not exist', async () => {
    mockGet.mockResolvedValue({ Item: undefined });
    const body = JSON.stringify({
      wrestlers: [{ name: 'Test Wrestler' }],
      companyId: 'nonexistent',
    });

    const r = await importWrestlers(ev({ body }), ctx, cb);
    expect(r!.statusCode).toBe(404);
    expect(JSON.parse(r!.body).message).toContain('Company not found');
  });

  it('returns 500 on unexpected error', async () => {
    mockBatchWrite.mockRejectedValue(new Error('DynamoDB failure'));
    const body = JSON.stringify({
      wrestlers: [{ name: 'Test Wrestler' }],
    });

    const r = await importWrestlers(ev({ body }), ctx, cb);
    expect(r!.statusCode).toBe(500);
    expect(JSON.parse(r!.body).message).toBe('Failed to import wrestlers');
  });
});
