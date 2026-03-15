import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEvent, Context, Callback } from 'aws-lambda';

// ─── Mocks ───────────────────────────────────────────────────────────

const { mockGet, mockPut, mockUpdate, mockScan, mockTransactWrite, mockDelete } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPut: vi.fn(),
  mockUpdate: vi.fn(),
  mockScan: vi.fn(),
  mockTransactWrite: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('../../../lib/dynamodb', () => ({
  dynamoDb: {
    get: mockGet,
    put: mockPut,
    scan: mockScan,
    query: vi.fn(),
    update: mockUpdate,
    delete: mockDelete,
    scanAll: vi.fn(),
    queryAll: vi.fn(),
    transactWrite: mockTransactWrite,
    batchWrite: vi.fn(),
  },
  TableNames: {
    DRAFTS: 'Drafts',
    WRESTLERS: 'Wrestlers',
    COMPANIES: 'Companies',
    MATCHES: 'Matches',
    CHAMPIONSHIPS: 'Championships',
    TOURNAMENTS: 'Tournaments',
    SEASONS: 'Seasons',
    EVENTS: 'Events',
    STIPULATIONS: 'Stipulations',
    SHOWS: 'Shows',
  },
  getOrNotFound: vi.fn(),
  buildUpdateExpression: vi.fn(),
}));

vi.mock('../../../lib/dynamodbUtils', () => ({
  getOrNotFound: vi.fn(),
  buildUpdateExpression: vi.fn(),
}));

vi.mock('uuid', () => ({ v4: () => 'test-draft-id' }));

import { handler as createDraft } from '../createDraft';
import { handler as getDrafts } from '../getDrafts';
import { handler as getDraft } from '../getDraft';
import { handler as updateDraft } from '../updateDraft';
import { handler as deleteDraft } from '../deleteDraft';
import { handler as startDraft } from '../startDraft';
import { handler as makePick } from '../makePick';
import { handler as protectWrestler } from '../protectWrestler';
import { handler as completeDraft } from '../completeDraft';
import { getOrNotFound } from '../../../lib/dynamodbUtils';
import { buildUpdateExpression } from '../../../lib/dynamodbUtils';

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

const mockGetOrNotFound = getOrNotFound as ReturnType<typeof vi.fn>;
const mockBuildUpdateExpression = buildUpdateExpression as ReturnType<typeof vi.fn>;

// ─── createDraft ─────────────────────────────────────────────────────

describe('createDraft', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a valid global draft and returns 201', async () => {
    // Mock company lookups
    mockGet.mockResolvedValueOnce({ Item: { companyId: 'c1' } });
    mockGet.mockResolvedValueOnce({ Item: { companyId: 'c2' } });
    mockPut.mockResolvedValue({});

    const event = makeEvent({
      body: JSON.stringify({
        name: 'Global Draft 2026',
        type: 'global',
        participatingCompanyIds: ['c1', 'c2'],
        rounds: 3,
      }),
    });

    const result = await createDraft(event, ctx, cb);

    expect(result!.statusCode).toBe(201);
    const body = JSON.parse(result!.body);
    expect(body.draftId).toBe('test-draft-id');
    expect(body.name).toBe('Global Draft 2026');
    expect(body.type).toBe('global');
    expect(body.status).toBe('setup');
    expect(body.rounds).toBe(3);
    expect(body.picks).toEqual([]);
    expect(body.protections).toEqual([]);
    expect(body.currentRound).toBe(0);
    expect(body.currentPickIndex).toBe(0);
    expect(mockPut).toHaveBeenCalledOnce();
  });

  it('creates a valid inter-company draft and returns 201', async () => {
    mockGet.mockResolvedValueOnce({ Item: { companyId: 'c1' } });
    mockGet.mockResolvedValueOnce({ Item: { companyId: 'c2' } });
    mockPut.mockResolvedValue({});

    const event = makeEvent({
      body: JSON.stringify({
        name: 'Inter-Company Draft',
        type: 'inter-company',
        participatingCompanyIds: ['c1', 'c2'],
        rounds: 2,
        snakeOrder: true,
        protectedPicksPerCompany: 3,
        includeGlobalPool: true,
      }),
    });

    const result = await createDraft(event, ctx, cb);

    expect(result!.statusCode).toBe(201);
    const body = JSON.parse(result!.body);
    expect(body.type).toBe('inter-company');
    expect(body.snakeOrder).toBe(true);
    expect(body.protectedPicksPerCompany).toBe(3);
    expect(body.includeGlobalPool).toBe(true);
  });

  it('returns 400 when name is missing', async () => {
    const event = makeEvent({
      body: JSON.stringify({
        type: 'global',
        participatingCompanyIds: ['c1', 'c2'],
        rounds: 3,
      }),
    });

    const result = await createDraft(event, ctx, cb);

    expect(result!.statusCode).toBe(400);
    expect(JSON.parse(result!.body).message).toBe('name is required');
  });

  it('returns 400 when type is invalid', async () => {
    const event = makeEvent({
      body: JSON.stringify({
        name: 'Draft',
        type: 'invalid',
        participatingCompanyIds: ['c1', 'c2'],
        rounds: 3,
      }),
    });

    const result = await createDraft(event, ctx, cb);

    expect(result!.statusCode).toBe(400);
    expect(JSON.parse(result!.body).message).toBe('type must be "global" or "inter-company"');
  });

  it('returns 400 when fewer than 2 companies', async () => {
    const event = makeEvent({
      body: JSON.stringify({
        name: 'Draft',
        type: 'global',
        participatingCompanyIds: ['c1'],
        rounds: 3,
      }),
    });

    const result = await createDraft(event, ctx, cb);

    expect(result!.statusCode).toBe(400);
    expect(JSON.parse(result!.body).message).toBe(
      'participatingCompanyIds must contain at least 2 company IDs'
    );
  });

  it('returns 404 when company does not exist', async () => {
    mockGet.mockResolvedValueOnce({ Item: { companyId: 'c1' } });
    mockGet.mockResolvedValueOnce({ Item: undefined });

    const event = makeEvent({
      body: JSON.stringify({
        name: 'Draft',
        type: 'global',
        participatingCompanyIds: ['c1', 'c2'],
        rounds: 3,
      }),
    });

    const result = await createDraft(event, ctx, cb);

    expect(result!.statusCode).toBe(404);
    expect(JSON.parse(result!.body).message).toContain('Company not found');
  });
});

// ─── getDrafts ───────────────────────────────────────────────────────

describe('getDrafts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns all drafts sorted by createdAt desc', async () => {
    mockScan.mockResolvedValue({
      Items: [
        { draftId: 'd-1', name: 'Draft 1', createdAt: '2026-01-01' },
        { draftId: 'd-2', name: 'Draft 2', createdAt: '2026-06-01' },
      ],
    });

    const result = await getDrafts(makeEvent(), ctx, cb);

    expect(result!.statusCode).toBe(200);
    const body = JSON.parse(result!.body);
    expect(body).toHaveLength(2);
    expect(body[0].name).toBe('Draft 2');
    expect(body[1].name).toBe('Draft 1');
    expect(mockScan).toHaveBeenCalledWith({ TableName: 'Drafts' });
  });
});

// ─── getDraft ────────────────────────────────────────────────────────

describe('getDraft', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns draft by ID', async () => {
    mockGet.mockResolvedValue({ Item: { draftId: 'd-1', name: 'My Draft' } });

    const result = await getDraft(
      makeEvent({ pathParameters: { draftId: 'd-1' } }),
      ctx,
      cb
    );

    expect(result!.statusCode).toBe(200);
    expect(JSON.parse(result!.body).name).toBe('My Draft');
  });

  it('returns 404 when not found', async () => {
    mockGet.mockResolvedValue({ Item: undefined });

    const result = await getDraft(
      makeEvent({ pathParameters: { draftId: 'nonexistent' } }),
      ctx,
      cb
    );

    expect(result!.statusCode).toBe(404);
    expect(JSON.parse(result!.body).message).toBe('Draft not found');
  });
});

// ─── updateDraft ─────────────────────────────────────────────────────

describe('updateDraft', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates draft settings when in setup status', async () => {
    mockGetOrNotFound.mockResolvedValue({
      item: { draftId: 'd-1', status: 'setup', participatingCompanyIds: ['c1', 'c2'] },
    });
    mockBuildUpdateExpression.mockReturnValue({
      UpdateExpression: 'SET #name = :name, #updatedAt = :updatedAt',
      ExpressionAttributeNames: { '#name': 'name', '#updatedAt': 'updatedAt' },
      ExpressionAttributeValues: { ':name': 'Updated Name', ':updatedAt': '2026-01-01' },
      hasChanges: true,
    });
    mockUpdate.mockResolvedValue({
      Attributes: { draftId: 'd-1', name: 'Updated Name', status: 'setup' },
    });

    const event = makeEvent({
      pathParameters: { draftId: 'd-1' },
      body: JSON.stringify({ name: 'Updated Name' }),
    });

    const result = await updateDraft(event, ctx, cb);

    expect(result!.statusCode).toBe(200);
    expect(JSON.parse(result!.body).name).toBe('Updated Name');
  });

  it('returns 400 when draft is active', async () => {
    mockGetOrNotFound.mockResolvedValue({
      item: { draftId: 'd-1', status: 'active', participatingCompanyIds: ['c1', 'c2'] },
    });

    const event = makeEvent({
      pathParameters: { draftId: 'd-1' },
      body: JSON.stringify({ name: 'Updated' }),
    });

    const result = await updateDraft(event, ctx, cb);

    expect(result!.statusCode).toBe(400);
    expect(JSON.parse(result!.body).message).toBe('Draft can only be updated when in setup status');
  });
});

// ─── deleteDraft ─────────────────────────────────────────────────────

describe('deleteDraft', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes a setup draft', async () => {
    mockGetOrNotFound.mockResolvedValue({
      item: { draftId: 'd-1', status: 'setup' },
    });
    mockDelete.mockResolvedValue({});

    const event = makeEvent({ pathParameters: { draftId: 'd-1' } });

    const result = await deleteDraft(event, ctx, cb);

    expect(result!.statusCode).toBe(204);
    expect(mockDelete).toHaveBeenCalledWith({
      TableName: 'Drafts',
      Key: { draftId: 'd-1' },
    });
  });

  it('returns 400 when draft is active', async () => {
    mockGetOrNotFound.mockResolvedValue({
      item: { draftId: 'd-1', status: 'active' },
    });

    const event = makeEvent({ pathParameters: { draftId: 'd-1' } });

    const result = await deleteDraft(event, ctx, cb);

    expect(result!.statusCode).toBe(400);
    expect(JSON.parse(result!.body).message).toBe(
      'Draft can only be deleted when in setup or completed status'
    );
  });
});

// ─── startDraft ──────────────────────────────────────────────────────

describe('startDraft', () => {
  beforeEach(() => vi.clearAllMocks());

  it('starts a setup draft and returns updated draft with status active', async () => {
    mockGetOrNotFound.mockResolvedValue({
      item: { draftId: 'd-1', status: 'setup' },
    });
    mockUpdate.mockResolvedValue({
      Attributes: { draftId: 'd-1', status: 'active', currentRound: 1, currentPickIndex: 0 },
    });

    const event = makeEvent({ pathParameters: { draftId: 'd-1' } });

    const result = await startDraft(event, ctx, cb);

    expect(result!.statusCode).toBe(200);
    const body = JSON.parse(result!.body);
    expect(body.status).toBe('active');
    expect(body.currentRound).toBe(1);
    expect(body.currentPickIndex).toBe(0);
  });

  it('returns 400 when draft is already active', async () => {
    mockGetOrNotFound.mockResolvedValue({
      item: { draftId: 'd-1', status: 'active' },
    });

    const event = makeEvent({ pathParameters: { draftId: 'd-1' } });

    const result = await startDraft(event, ctx, cb);

    expect(result!.statusCode).toBe(400);
    expect(JSON.parse(result!.body).message).toBe(
      'Draft can only be started when in setup status'
    );
  });
});

// ─── makePick ────────────────────────────────────────────────────────

describe('makePick', () => {
  beforeEach(() => vi.clearAllMocks());

  const activeDraft = {
    draftId: 'd-1',
    status: 'active',
    type: 'global' as const,
    draftOrder: ['c1', 'c2'],
    currentRound: 1,
    currentPickIndex: 0,
    picks: [],
    snakeOrder: true,
    rounds: 2,
    protections: [],
    participatingCompanyIds: ['c1', 'c2'],
    includeGlobalPool: false,
  };

  it('makes a valid pick for global draft and updates wrestler companyId', async () => {
    mockGet.mockResolvedValueOnce({ Item: { ...activeDraft } });
    mockGet.mockResolvedValueOnce({ Item: { wrestlerId: 'w1' } }); // no companyId = unassigned
    mockTransactWrite.mockResolvedValue({});

    const event = makeEvent({
      pathParameters: { draftId: 'd-1' },
      body: JSON.stringify({ companyId: 'c1', wrestlerId: 'w1' }),
    });

    const result = await makePick(event, ctx, cb);

    expect(result!.statusCode).toBe(200);
    const body = JSON.parse(result!.body);
    expect(body.pick.pickNumber).toBe(1);
    expect(body.pick.round).toBe(1);
    expect(body.pick.companyId).toBe('c1');
    expect(body.pick.wrestlerId).toBe('w1');
    expect(body.draftState.currentPickIndex).toBe(1);
    expect(mockTransactWrite).toHaveBeenCalledOnce();

    const transactCall = mockTransactWrite.mock.calls[0][0];
    expect(transactCall.TransactItems).toHaveLength(2);
    expect(transactCall.TransactItems[0].Update.TableName).toBe('Drafts');
    expect(transactCall.TransactItems[1].Update.TableName).toBe('Wrestlers');
    expect(transactCall.TransactItems[1].Update.ExpressionAttributeValues[':companyId']).toBe('c1');
  });

  it('returns 400 when wrong company\'s turn', async () => {
    mockGet.mockResolvedValueOnce({ Item: { ...activeDraft } });

    const event = makeEvent({
      pathParameters: { draftId: 'd-1' },
      body: JSON.stringify({ companyId: 'c2', wrestlerId: 'w1' }),
    });

    const result = await makePick(event, ctx, cb);

    expect(result!.statusCode).toBe(400);
    expect(JSON.parse(result!.body).message).toContain('not this company\'s turn');
  });

  it('returns 400 when wrestler already picked', async () => {
    const draftWithPick = {
      ...activeDraft,
      currentPickIndex: 1,
      picks: [{ pickNumber: 1, round: 1, companyId: 'c1', wrestlerId: 'w1', pickedAt: '2026-01-01' }],
    };
    mockGet.mockResolvedValueOnce({ Item: { ...draftWithPick } });
    mockGet.mockResolvedValueOnce({ Item: { wrestlerId: 'w1' } });

    const event = makeEvent({
      pathParameters: { draftId: 'd-1' },
      body: JSON.stringify({ companyId: 'c2', wrestlerId: 'w1' }),
    });

    const result = await makePick(event, ctx, cb);

    expect(result!.statusCode).toBe(400);
    expect(JSON.parse(result!.body).message).toBe('Wrestler has already been picked in this draft');
  });

  it('returns 400 when wrestler is not in the eligible pool', async () => {
    // Global draft: wrestler has a companyId (already assigned)
    mockGet.mockResolvedValueOnce({ Item: { ...activeDraft } });
    mockGet.mockResolvedValueOnce({ Item: { wrestlerId: 'w1', companyId: 'c1' } });

    const event = makeEvent({
      pathParameters: { draftId: 'd-1' },
      body: JSON.stringify({ companyId: 'c1', wrestlerId: 'w1' }),
    });

    const result = await makePick(event, ctx, cb);

    expect(result!.statusCode).toBe(400);
    expect(JSON.parse(result!.body).message).toBe(
      'In a global draft, only unassigned wrestlers can be picked'
    );
  });

  it('auto-completes draft when last pick is made', async () => {
    // Last pick: round 2, 2 companies, pick index 3 (4th pick total)
    // After this pick: newPickIndex=4, 4%2=0 => newRound=3, 3>2 => completed
    const nearEndDraft = {
      ...activeDraft,
      currentRound: 2,
      currentPickIndex: 3,
      picks: [
        { pickNumber: 1, round: 1, companyId: 'c1', wrestlerId: 'w1', pickedAt: '2026-01-01' },
        { pickNumber: 2, round: 1, companyId: 'c2', wrestlerId: 'w2', pickedAt: '2026-01-01' },
        { pickNumber: 3, round: 2, companyId: 'c2', wrestlerId: 'w3', pickedAt: '2026-01-01' },
      ],
    };
    // Snake order, round 2 (even) is reversed: [c2, c1] -> index 3%2=1 -> reversed index = 2-1-1 = 0 -> c2
    // Wait, let's recalculate: draftOrder=['c1','c2'], round 2 (even), indexInRound=3%2=1, reversed: 2-1-1=0 -> c1
    mockGet.mockResolvedValueOnce({ Item: { ...nearEndDraft } });
    mockGet.mockResolvedValueOnce({ Item: { wrestlerId: 'w4' } }); // unassigned

    const event = makeEvent({
      pathParameters: { draftId: 'd-1' },
      body: JSON.stringify({ companyId: 'c1', wrestlerId: 'w4' }),
    });

    const result = await makePick(event, ctx, cb);

    expect(result!.statusCode).toBe(200);
    const body = JSON.parse(result!.body);
    expect(body.draftState.status).toBe('completed');

    const transactCall = mockTransactWrite.mock.calls[0][0];
    expect(transactCall.TransactItems[0].Update.ExpressionAttributeValues[':status']).toBe('completed');
  });
});

// ─── protectWrestler ─────────────────────────────────────────────────

describe('protectWrestler', () => {
  beforeEach(() => vi.clearAllMocks());

  const interCompanyDraft = {
    draftId: 'd-1',
    status: 'setup',
    type: 'inter-company',
    participatingCompanyIds: ['c1', 'c2'],
    protectedPicksPerCompany: 2,
    protections: [],
  };

  it('protects a wrestler for inter-company draft', async () => {
    mockGet.mockResolvedValueOnce({ Item: { ...interCompanyDraft } });
    mockGet.mockResolvedValueOnce({ Item: { wrestlerId: 'w1', companyId: 'c1' } });
    mockUpdate.mockResolvedValue({
      Attributes: { ...interCompanyDraft, protections: [{ companyId: 'c1', wrestlerId: 'w1' }] },
    });

    const event = makeEvent({
      pathParameters: { draftId: 'd-1' },
      body: JSON.stringify({ companyId: 'c1', wrestlerId: 'w1' }),
    });

    const result = await protectWrestler(event, ctx, cb);

    expect(result!.statusCode).toBe(200);
    const body = JSON.parse(result!.body);
    expect(body.protection.companyId).toBe('c1');
    expect(body.protection.wrestlerId).toBe('w1');
  });

  it('returns 400 when draft type is global', async () => {
    const globalDraft = { ...interCompanyDraft, type: 'global' };
    mockGet.mockResolvedValueOnce({ Item: { ...globalDraft } });

    const event = makeEvent({
      pathParameters: { draftId: 'd-1' },
      body: JSON.stringify({ companyId: 'c1', wrestlerId: 'w1' }),
    });

    const result = await protectWrestler(event, ctx, cb);

    expect(result!.statusCode).toBe(400);
    expect(JSON.parse(result!.body).message).toBe(
      'Protections are only available for inter-company drafts'
    );
  });

  it('returns 400 when company exceeded protection limit', async () => {
    const draftAtLimit = {
      ...interCompanyDraft,
      protections: [
        { companyId: 'c1', wrestlerId: 'w1' },
        { companyId: 'c1', wrestlerId: 'w2' },
      ],
    };
    mockGet.mockResolvedValueOnce({ Item: { ...draftAtLimit } });
    mockGet.mockResolvedValueOnce({ Item: { wrestlerId: 'w3', companyId: 'c1' } });

    const event = makeEvent({
      pathParameters: { draftId: 'd-1' },
      body: JSON.stringify({ companyId: 'c1', wrestlerId: 'w3' }),
    });

    const result = await protectWrestler(event, ctx, cb);

    expect(result!.statusCode).toBe(400);
    expect(JSON.parse(result!.body).message).toBe(
      'Company has reached the maximum number of protected picks'
    );
  });
});

// ─── completeDraft ───────────────────────────────────────────────────

describe('completeDraft', () => {
  beforeEach(() => vi.clearAllMocks());

  it('completes an active draft', async () => {
    mockGetOrNotFound.mockResolvedValue({
      item: { draftId: 'd-1', status: 'active' },
    });
    mockUpdate.mockResolvedValue({
      Attributes: { draftId: 'd-1', status: 'completed' },
    });

    const event = makeEvent({ pathParameters: { draftId: 'd-1' } });

    const result = await completeDraft(event, ctx, cb);

    expect(result!.statusCode).toBe(200);
    expect(JSON.parse(result!.body).status).toBe('completed');
  });

  it('returns 400 when draft is in setup status', async () => {
    mockGetOrNotFound.mockResolvedValue({
      item: { draftId: 'd-1', status: 'setup' },
    });

    const event = makeEvent({ pathParameters: { draftId: 'd-1' } });

    const result = await completeDraft(event, ctx, cb);

    expect(result!.statusCode).toBe(400);
    expect(JSON.parse(result!.body).message).toBe(
      'Draft can only be completed when in active status'
    );
  });
});
