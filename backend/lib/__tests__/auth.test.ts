import { describe, it, expect } from 'vitest';
import { APIGatewayProxyEvent } from 'aws-lambda';
import {
  getAuthContext,
  hasRole,
  isSuperAdmin,
  requireRole,
  requireSuperAdmin,
  AuthContext,
} from '../auth';

/** Helper to build a minimal APIGatewayProxyEvent with authorizer context */
function makeEvent(authorizer: Record<string, string> = {}): APIGatewayProxyEvent {
  return {
    requestContext: { authorizer } as unknown as APIGatewayProxyEvent['requestContext'],
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
  };
}

// ─── getAuthContext ──────────────────────────────────────────────────────────

describe('getAuthContext', () => {
  it('extracts username, email, sub, and groups from authorizer', () => {
    const event = makeEvent({
      username: 'john',
      email: 'john@example.com',
      principalId: 'sub-123',
      groups: 'Admin',
    });

    const ctx = getAuthContext(event);

    expect(ctx.username).toBe('john');
    expect(ctx.email).toBe('john@example.com');
    expect(ctx.sub).toBe('sub-123');
    expect(ctx.groups).toEqual(['Admin']);
  });

  it('returns empty strings and empty groups when authorizer is missing', () => {
    const event = makeEvent();

    const ctx = getAuthContext(event);

    expect(ctx.username).toBe('');
    expect(ctx.email).toBe('');
    expect(ctx.sub).toBe('');
    expect(ctx.groups).toEqual([]);
  });

  it('handles groups with whitespace between entries', () => {
    const event = makeEvent({ groups: ' Admin ' });

    const ctx = getAuthContext(event);

    expect(ctx.groups).toEqual(['Admin']);
  });

  it('returns empty groups when groups string is empty', () => {
    const event = makeEvent({ groups: '' });

    const ctx = getAuthContext(event);

    expect(ctx.groups).toEqual([]);
  });
});

// ─── hasRole ─────────────────────────────────────────────────────────────────

describe('hasRole', () => {
  it('returns true when user has Admin role', () => {
    const ctx: AuthContext = { username: 'u', email: 'e', sub: 's', groups: ['Admin'] };

    expect(hasRole(ctx, 'Admin')).toBe(true);
  });

  it('returns false when user has no groups', () => {
    const ctx: AuthContext = { username: 'u', email: 'e', sub: 's', groups: [] };

    expect(hasRole(ctx, 'Admin')).toBe(false);
  });
});

// ─── isSuperAdmin ────────────────────────────────────────────────────────────

describe('isSuperAdmin', () => {
  it('returns true for Admin group', () => {
    const ctx: AuthContext = { username: 'u', email: 'e', sub: 's', groups: ['Admin'] };

    expect(isSuperAdmin(ctx)).toBe(true);
  });

  it('returns false for empty groups', () => {
    const ctx: AuthContext = { username: 'u', email: 'e', sub: 's', groups: [] };

    expect(isSuperAdmin(ctx)).toBe(false);
  });
});

// ─── requireRole ─────────────────────────────────────────────────────────────

describe('requireRole', () => {
  it('returns null (authorized) when user has the required role', () => {
    const event = makeEvent({
      username: 'admin',
      email: 'a@b.com',
      principalId: 'sub-1',
      groups: 'Admin',
    });

    expect(requireRole(event, 'Admin')).toBeNull();
  });

  it('returns 403 response when user lacks the required role', () => {
    const event = makeEvent({
      username: 'wrestler',
      email: 'p@b.com',
      principalId: 'sub-2',
      groups: '',
    });

    const result = requireRole(event, 'Admin');

    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(403);
    expect(JSON.parse(result!.body)).toEqual({
      message: 'You do not have permission to perform this action',
    });
  });
});

// ─── requireSuperAdmin ──────────────────────────────────────────────────────

describe('requireSuperAdmin', () => {
  it('returns null (authorized) for Admin', () => {
    const event = makeEvent({
      username: 'admin',
      email: 'a@b.com',
      principalId: 'sub-1',
      groups: 'Admin',
    });

    expect(requireSuperAdmin(event)).toBeNull();
  });

  it('returns 403 for non-admin user', () => {
    const event = makeEvent({
      username: 'user',
      email: 'u@b.com',
      principalId: 'sub-2',
      groups: '',
    });

    const result = requireSuperAdmin(event);

    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(403);
    expect(JSON.parse(result!.body)).toEqual({
      message: 'This action requires full Admin privileges',
    });
  });
});
