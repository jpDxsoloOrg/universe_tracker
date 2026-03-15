import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';

const mockGetDrafts = vi.fn();
const mockGetDraft = vi.fn();
const mockCreateDraft = vi.fn();
const mockUpdateDraft = vi.fn();
const mockDeleteDraft = vi.fn();
const mockStartDraft = vi.fn();
const mockMakePick = vi.fn();
const mockProtectWrestler = vi.fn();
const mockCompleteDraft = vi.fn();

vi.mock('../getDrafts', () => ({ handler: (...args: unknown[]) => mockGetDrafts(...args) }));
vi.mock('../getDraft', () => ({ handler: (...args: unknown[]) => mockGetDraft(...args) }));
vi.mock('../createDraft', () => ({ handler: (...args: unknown[]) => mockCreateDraft(...args) }));
vi.mock('../updateDraft', () => ({ handler: (...args: unknown[]) => mockUpdateDraft(...args) }));
vi.mock('../deleteDraft', () => ({ handler: (...args: unknown[]) => mockDeleteDraft(...args) }));
vi.mock('../startDraft', () => ({ handler: (...args: unknown[]) => mockStartDraft(...args) }));
vi.mock('../makePick', () => ({ handler: (...args: unknown[]) => mockMakePick(...args) }));
vi.mock('../protectWrestler', () => ({ handler: (...args: unknown[]) => mockProtectWrestler(...args) }));
vi.mock('../completeDraft', () => ({ handler: (...args: unknown[]) => mockCompleteDraft(...args) }));

import { handler } from '../handler';

const ctx = {} as Context;
const noopCb = () => {};

function makeEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    httpMethod: 'GET',
    path: '/drafts',
    pathParameters: null,
    body: null,
    headers: {},
    multiValueHeaders: {},
    isBase64Encoded: false,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as APIGatewayProxyEvent['requestContext'],
    resource: '/drafts',
    ...overrides,
  };
}

describe('drafts router handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDrafts.mockResolvedValue({ statusCode: 200, body: '[]' });
    mockGetDraft.mockResolvedValue({ statusCode: 200, body: '{}' });
    mockCreateDraft.mockResolvedValue({ statusCode: 201, body: '{}' });
    mockUpdateDraft.mockResolvedValue({ statusCode: 200, body: '{}' });
    mockDeleteDraft.mockResolvedValue({ statusCode: 204, body: '' });
    mockStartDraft.mockResolvedValue({ statusCode: 200, body: '{}' });
    mockMakePick.mockResolvedValue({ statusCode: 200, body: '{}' });
    mockProtectWrestler.mockResolvedValue({ statusCode: 200, body: '{}' });
    mockCompleteDraft.mockResolvedValue({ statusCode: 200, body: '{}' });
  });

  it('GET /drafts calls getDrafts', async () => {
    const event = makeEvent({ httpMethod: 'GET', resource: '/drafts' });
    const result = await handler(event, ctx, noopCb);
    expect(mockGetDrafts).toHaveBeenCalledWith(event, ctx, noopCb);
    expect(result!.statusCode).toBe(200);
  });

  it('POST /drafts calls createDraft', async () => {
    const event = makeEvent({ httpMethod: 'POST', resource: '/drafts' });
    const result = await handler(event, ctx, noopCb);
    expect(mockCreateDraft).toHaveBeenCalledWith(event, ctx, noopCb);
    expect(result!.statusCode).toBe(201);
  });

  it('GET /drafts/{draftId} calls getDraft', async () => {
    const event = makeEvent({
      httpMethod: 'GET',
      resource: '/drafts/{draftId}',
      pathParameters: { draftId: 'd-1' },
    });
    const result = await handler(event, ctx, noopCb);
    expect(mockGetDraft).toHaveBeenCalledWith(event, ctx, noopCb);
    expect(result!.statusCode).toBe(200);
  });

  it('PUT /drafts/{draftId} calls updateDraft', async () => {
    const event = makeEvent({
      httpMethod: 'PUT',
      resource: '/drafts/{draftId}',
      pathParameters: { draftId: 'd-1' },
    });
    const result = await handler(event, ctx, noopCb);
    expect(mockUpdateDraft).toHaveBeenCalledWith(event, ctx, noopCb);
    expect(result!.statusCode).toBe(200);
  });

  it('DELETE /drafts/{draftId} calls deleteDraft', async () => {
    const event = makeEvent({
      httpMethod: 'DELETE',
      resource: '/drafts/{draftId}',
      pathParameters: { draftId: 'd-1' },
    });
    const result = await handler(event, ctx, noopCb);
    expect(mockDeleteDraft).toHaveBeenCalledWith(event, ctx, noopCb);
    expect(result!.statusCode).toBe(204);
  });

  it('POST /drafts/{draftId}/start calls startDraft', async () => {
    const event = makeEvent({
      httpMethod: 'POST',
      resource: '/drafts/{draftId}/start',
      pathParameters: { draftId: 'd-1' },
    });
    const result = await handler(event, ctx, noopCb);
    expect(mockStartDraft).toHaveBeenCalledWith(event, ctx, noopCb);
    expect(result!.statusCode).toBe(200);
  });

  it('POST /drafts/{draftId}/pick calls makePick', async () => {
    const event = makeEvent({
      httpMethod: 'POST',
      resource: '/drafts/{draftId}/pick',
      pathParameters: { draftId: 'd-1' },
    });
    const result = await handler(event, ctx, noopCb);
    expect(mockMakePick).toHaveBeenCalledWith(event, ctx, noopCb);
    expect(result!.statusCode).toBe(200);
  });

  it('POST /drafts/{draftId}/protect calls protectWrestler', async () => {
    const event = makeEvent({
      httpMethod: 'POST',
      resource: '/drafts/{draftId}/protect',
      pathParameters: { draftId: 'd-1' },
    });
    const result = await handler(event, ctx, noopCb);
    expect(mockProtectWrestler).toHaveBeenCalledWith(event, ctx, noopCb);
    expect(result!.statusCode).toBe(200);
  });

  it('POST /drafts/{draftId}/complete calls completeDraft', async () => {
    const event = makeEvent({
      httpMethod: 'POST',
      resource: '/drafts/{draftId}/complete',
      pathParameters: { draftId: 'd-1' },
    });
    const result = await handler(event, ctx, noopCb);
    expect(mockCompleteDraft).toHaveBeenCalledWith(event, ctx, noopCb);
    expect(result!.statusCode).toBe(200);
  });

  it('PATCH returns 405 Method Not Allowed', async () => {
    const event = makeEvent({ httpMethod: 'PATCH' });
    const result = await handler(event, ctx, noopCb);
    expect(result!.statusCode).toBe(405);
  });
});
