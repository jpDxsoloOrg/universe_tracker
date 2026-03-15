import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEvent, Context, Callback } from 'aws-lambda';

const { mockScanAll } = vi.hoisted(() => ({
  mockScanAll: vi.fn(),
}));

vi.mock('../../../lib/dynamodb', () => ({
  dynamoDb: {
    get: vi.fn(),
    put: vi.fn(),
    scan: vi.fn(),
    query: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    scanAll: mockScanAll,
    queryAll: vi.fn(),
  },
  TableNames: {
    WRESTLERS: 'Wrestlers',
    MATCHES: 'Matches',
    MATCH_TYPES: 'MatchTypes',
    STIPULATIONS: 'Stipulations',
    CHAMPIONSHIPS: 'Championships',
    CHAMPIONSHIP_HISTORY: 'ChampionshipHistory',
  },
}));

import { handler } from '../getStatistics';

const ctx = {} as Context;
const cb: Callback = () => {};

function makeEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    body: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'GET',
    isBase64Encoded: false,
    path: '/statistics',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    resource: '',
    requestContext: {} as any,
    ...overrides,
  };
}

function makeWrestler(wrestlerId: string, name: string) {
  return {
    wrestlerId,
    name,
    wins: 0,
    losses: 0,
    draws: 0,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };
}

function makeMatch(overrides: Record<string, unknown> = {}) {
  return {
    matchId: `m-${Math.random().toString(36).slice(2, 8)}`,
    date: '2024-06-15',
    matchFormat: 'Single',
    participants: ['p1', 'p2'],
    winners: ['p1'],
    losers: ['p2'],
    isChampionship: false,
    status: 'completed',
    ...overrides,
  };
}

describe('getStatistics - match-types section', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns all completed matches leaderboard when no filter is provided', async () => {
    const wrestlers = [
      makeWrestler('p1', 'Alpha'),
      makeWrestler('p2', 'Beta'),
      makeWrestler('p3', 'Gamma'),
    ];

    const matches = [
      makeMatch({ participants: ['p1', 'p2'], winners: ['p1'], losers: ['p2'], matchFormat: 'Single' }),
      makeMatch({ participants: ['p2', 'p3'], winners: ['p2'], losers: ['p3'], matchFormat: 'Tag Team' }),
      makeMatch({ participants: ['p3', 'p1'], winners: ['p3'], losers: ['p1'], matchFormat: 'Triple Threat' }),
    ];

    mockScanAll
      .mockResolvedValueOnce(wrestlers)
      .mockResolvedValueOnce(matches)
      .mockResolvedValueOnce([
        { matchTypeId: 'mt-single', name: 'Single' },
        { matchTypeId: 'mt-tag', name: 'Tag Team' },
      ])
      .mockResolvedValueOnce([
        { stipulationId: 'stip-none', name: 'No DQ' },
      ]);

    const result = await handler(makeEvent({
      queryStringParameters: { section: 'match-types' },
    }), ctx, cb);

    expect(result!.statusCode).toBe(200);
    const body = JSON.parse(result!.body);
    expect(Array.isArray(body.leaderboard)).toBe(true);
    expect(body.leaderboard).toHaveLength(3);
    expect(body.appliedFilters.matchTypeId).toBeUndefined();
    expect(body.appliedFilters.stipulationId).toBeUndefined();
  });

  it('filters by matchTypeId using configured match type names', async () => {
    const wrestlers = [
      makeWrestler('p1', 'Alpha'),
      makeWrestler('p2', 'Beta'),
      makeWrestler('p3', 'Gamma'),
    ];
    const matches = [
      makeMatch({ participants: ['p1', 'p2'], winners: ['p1'], losers: ['p2'], matchFormat: 'Single' }),
      makeMatch({ participants: ['p2', 'p3'], winners: ['p2'], losers: ['p3'], matchFormat: 'Tag Team' }),
      makeMatch({ participants: ['p2', 'p1'], winners: ['p2'], losers: ['p1'], matchFormat: 'Tag Team' }),
      makeMatch({ participants: ['p3', 'p1'], winners: ['p3'], losers: ['p1'], matchFormat: 'Triple Threat' }),
    ];

    mockScanAll
      .mockResolvedValueOnce(wrestlers)
      .mockResolvedValueOnce(matches)
      .mockResolvedValueOnce([
        { matchTypeId: 'mt-single', name: 'Single' },
        { matchTypeId: 'mt-tag', name: 'Tag Team' },
      ])
      .mockResolvedValueOnce([]);

    const result = await handler(makeEvent({
      queryStringParameters: { section: 'match-types', matchTypeId: 'mt-tag' },
    }), ctx, cb);

    expect(result!.statusCode).toBe(200);
    const body = JSON.parse(result!.body);
    expect(body.appliedFilters.matchTypeId).toBe('mt-tag');
    expect(body.appliedFilters.matchTypeName).toBe('Tag Team');
    expect(body.leaderboard[0].wrestlerName).toBe('Beta');
    expect(body.leaderboard[0].wins).toBe(2);
    expect(body.leaderboard[0].matchesPlayed).toBe(2);
  });

  it('filters by stipulationId', async () => {
    const wrestlers = [
      makeWrestler('p1', 'Alpha'),
      makeWrestler('p2', 'Beta'),
    ];
    const matches = [
      makeMatch({
        participants: ['p1', 'p2'],
        winners: ['p1'],
        losers: ['p2'],
        matchFormat: 'Single',
        stipulationId: 'stip-cage',
      }),
      makeMatch({
        participants: ['p1', 'p2'],
        winners: ['p2'],
        losers: ['p1'],
        matchFormat: 'Single',
        stipulationId: 'stip-ladder',
      }),
    ];

    mockScanAll
      .mockResolvedValueOnce(wrestlers)
      .mockResolvedValueOnce(matches)
      .mockResolvedValueOnce([{ matchTypeId: 'mt-single', name: 'Single' }])
      .mockResolvedValueOnce([
        { stipulationId: 'stip-cage', name: 'Steel Cage' },
        { stipulationId: 'stip-ladder', name: 'Ladder Match' },
      ]);

    const result = await handler(makeEvent({
      queryStringParameters: { section: 'match-types', stipulationId: 'stip-cage' },
    }), ctx, cb);

    expect(result!.statusCode).toBe(200);
    const body = JSON.parse(result!.body);
    expect(body.appliedFilters.stipulationId).toBe('stip-cage');
    expect(body.appliedFilters.stipulationName).toBe('Steel Cage');
    expect(body.leaderboard).toHaveLength(2);
    expect(body.leaderboard[0].wins).toBe(1);
    expect(body.leaderboard[1].wins).toBe(0);
  });
});
