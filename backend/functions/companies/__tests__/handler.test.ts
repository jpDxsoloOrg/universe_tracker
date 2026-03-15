import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';

const mockGetCompanies = vi.fn();
const mockGetCompany = vi.fn();
const mockCreateCompany = vi.fn();
const mockUpdateCompany = vi.fn();
const mockDeleteCompany = vi.fn();

vi.mock('../getCompanies', () => ({ handler: (...args: unknown[]) => mockGetCompanies(...args) }));
vi.mock('../getCompany', () => ({ handler: (...args: unknown[]) => mockGetCompany(...args) }));
vi.mock('../createCompany', () => ({ handler: (...args: unknown[]) => mockCreateCompany(...args) }));
vi.mock('../updateCompany', () => ({ handler: (...args: unknown[]) => mockUpdateCompany(...args) }));
vi.mock('../deleteCompany', () => ({ handler: (...args: unknown[]) => mockDeleteCompany(...args) }));

import { handler } from '../handler';

const ctx = {} as Context;
const noopCb = () => {};

function makeEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    httpMethod: 'GET',
    path: '/companies',
    pathParameters: null,
    body: null,
    headers: {},
    multiValueHeaders: {},
    isBase64Encoded: false,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as APIGatewayProxyEvent['requestContext'],
    resource: '/companies',
    ...overrides,
  };
}

describe('companies router handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCompanies.mockResolvedValue({ statusCode: 200, body: '[]' });
    mockGetCompany.mockResolvedValue({ statusCode: 200, body: '{}' });
    mockCreateCompany.mockResolvedValue({ statusCode: 201, body: '{}' });
    mockUpdateCompany.mockResolvedValue({ statusCode: 200, body: '{}' });
    mockDeleteCompany.mockResolvedValue({ statusCode: 204, body: '' });
  });

  it('GET /companies calls getCompanies', async () => {
    const event = makeEvent({ httpMethod: 'GET', resource: '/companies' });
    const result = await handler(event, ctx, noopCb);
    expect(mockGetCompanies).toHaveBeenCalledWith(event, ctx, noopCb);
    expect(result!.statusCode).toBe(200);
  });

  it('POST /companies calls createCompany', async () => {
    const event = makeEvent({ httpMethod: 'POST', resource: '/companies' });
    const result = await handler(event, ctx, noopCb);
    expect(mockCreateCompany).toHaveBeenCalledWith(event, ctx, noopCb);
    expect(result!.statusCode).toBe(201);
  });

  it('GET /companies/{companyId} calls getCompany', async () => {
    const event = makeEvent({
      httpMethod: 'GET',
      resource: '/companies/{companyId}',
      pathParameters: { companyId: 'c-1' },
    });
    const result = await handler(event, ctx, noopCb);
    expect(mockGetCompany).toHaveBeenCalledWith(event, ctx, noopCb);
    expect(result!.statusCode).toBe(200);
  });

  it('PUT /companies/{companyId} calls updateCompany', async () => {
    const event = makeEvent({
      httpMethod: 'PUT',
      resource: '/companies/{companyId}',
      pathParameters: { companyId: 'c-1' },
    });
    const result = await handler(event, ctx, noopCb);
    expect(mockUpdateCompany).toHaveBeenCalledWith(event, ctx, noopCb);
    expect(result!.statusCode).toBe(200);
  });

  it('DELETE /companies/{companyId} calls deleteCompany', async () => {
    const event = makeEvent({
      httpMethod: 'DELETE',
      resource: '/companies/{companyId}',
      pathParameters: { companyId: 'c-1' },
    });
    const result = await handler(event, ctx, noopCb);
    expect(mockDeleteCompany).toHaveBeenCalledWith(event, ctx, noopCb);
    expect(result!.statusCode).toBe(204);
  });

  it('PATCH returns 405 Method Not Allowed', async () => {
    const event = makeEvent({ httpMethod: 'PATCH' });
    const result = await handler(event, ctx, noopCb);
    expect(result!.statusCode).toBe(405);
  });
});
