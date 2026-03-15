import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';

const mockGetShows = vi.fn();
const mockGetShow = vi.fn();
const mockCreateShow = vi.fn();
const mockUpdateShow = vi.fn();
const mockDeleteShow = vi.fn();

vi.mock('../getShows', () => ({ handler: (...args: unknown[]) => mockGetShows(...args) }));
vi.mock('../getShow', () => ({ handler: (...args: unknown[]) => mockGetShow(...args) }));
vi.mock('../createShow', () => ({ handler: (...args: unknown[]) => mockCreateShow(...args) }));
vi.mock('../updateShow', () => ({ handler: (...args: unknown[]) => mockUpdateShow(...args) }));
vi.mock('../deleteShow', () => ({ handler: (...args: unknown[]) => mockDeleteShow(...args) }));

import { handler } from '../handler';

const ctx = {} as Context;
const noopCb = () => {};

function makeEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    httpMethod: 'GET',
    path: '/shows',
    pathParameters: null,
    body: null,
    headers: {},
    multiValueHeaders: {},
    isBase64Encoded: false,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as APIGatewayProxyEvent['requestContext'],
    resource: '/shows',
    ...overrides,
  };
}

describe('shows router handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetShows.mockResolvedValue({ statusCode: 200, body: '[]' });
    mockGetShow.mockResolvedValue({ statusCode: 200, body: '{}' });
    mockCreateShow.mockResolvedValue({ statusCode: 201, body: '{}' });
    mockUpdateShow.mockResolvedValue({ statusCode: 200, body: '{}' });
    mockDeleteShow.mockResolvedValue({ statusCode: 204, body: '' });
  });

  it('GET /shows calls getShows', async () => {
    const event = makeEvent({ httpMethod: 'GET', resource: '/shows' });
    const result = await handler(event, ctx, noopCb);
    expect(mockGetShows).toHaveBeenCalledWith(event, ctx, noopCb);
    expect(result!.statusCode).toBe(200);
  });

  it('POST /shows calls createShow', async () => {
    const event = makeEvent({ httpMethod: 'POST', resource: '/shows' });
    const result = await handler(event, ctx, noopCb);
    expect(mockCreateShow).toHaveBeenCalledWith(event, ctx, noopCb);
    expect(result!.statusCode).toBe(201);
  });

  it('GET /shows/{showId} calls getShow', async () => {
    const event = makeEvent({
      httpMethod: 'GET',
      resource: '/shows/{showId}',
      pathParameters: { showId: 's-1' },
    });
    const result = await handler(event, ctx, noopCb);
    expect(mockGetShow).toHaveBeenCalledWith(event, ctx, noopCb);
    expect(result!.statusCode).toBe(200);
  });

  it('PUT /shows/{showId} calls updateShow', async () => {
    const event = makeEvent({
      httpMethod: 'PUT',
      resource: '/shows/{showId}',
      pathParameters: { showId: 's-1' },
    });
    const result = await handler(event, ctx, noopCb);
    expect(mockUpdateShow).toHaveBeenCalledWith(event, ctx, noopCb);
    expect(result!.statusCode).toBe(200);
  });

  it('DELETE /shows/{showId} calls deleteShow', async () => {
    const event = makeEvent({
      httpMethod: 'DELETE',
      resource: '/shows/{showId}',
      pathParameters: { showId: 's-1' },
    });
    const result = await handler(event, ctx, noopCb);
    expect(mockDeleteShow).toHaveBeenCalledWith(event, ctx, noopCb);
    expect(result!.statusCode).toBe(204);
  });

  it('PATCH returns 405 Method Not Allowed', async () => {
    const event = makeEvent({ httpMethod: 'PATCH' });
    const result = await handler(event, ctx, noopCb);
    expect(result!.statusCode).toBe(405);
  });
});
