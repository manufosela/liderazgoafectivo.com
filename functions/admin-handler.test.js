import { describe, expect, it } from 'vitest';
import { validateAccess } from './access.js';
import { NotAdminError } from './admin-auth.js';
import { createAdminHandler } from './admin-handler.js';

const fingerprintKey = 'fingerprint-key-with-at-least-32-chars';
const origin = 'https://liderazgoafectivo.com';
const email = 'lectora@example.com';
const now = new Date('2026-11-21T10:00:00Z');

const createGrantStore = () => {
  const grants = new Map();
  return {
    grants,
    get: async (id) => grants.get(id) ?? null,
    create: async (id, record) => grants.set(id, record),
    list: async () => [...grants].map(([id, record]) => ({ id, ...record })),
    revoke: async (id, revokedAt) => grants.set(id, { ...grants.get(id), revoked: true, revokedAt }),
  };
};

const createResponse = () => ({
  statusCode: 200,
  headers: {},
  body: undefined,
  status(code) {
    this.statusCode = code;
    return this;
  },
  set(name, value) {
    this.headers[name] = value;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
  send(body) {
    this.body = body;
    return this;
  },
});

const verifyAdmin = async (authorization) => {
  if (authorization !== 'Bearer admin-token') throw new NotAdminError('test');
  return 'autor@example.com';
};

const setUp = ({ grants = createGrantStore() } = {}) => {
  const handler = createAdminHandler({ verifyAdmin, grants, fingerprintKey: () => fingerprintKey, now: () => now });
  const send = async ({ method = 'GET', path = '/grants', from = origin, token = 'admin-token', body } = {}) => {
    const headers = { origin: from ?? undefined, authorization: token ? `Bearer ${token}` : undefined };
    const response = createResponse();
    await handler({ method, path, body, get: (name) => headers[name] }, response);
    return response;
  };
  return { grants, send };
};

describe('admin handler', () => {
  it('creates a code that works once, then lists it without code nor email', async () => {
    const { grants, send } = setUp();

    const created = await send({ method: 'POST', body: { email, note: 'Regalo' } });

    expect(created.statusCode).toBe(201);
    expect(created.headers['Access-Control-Allow-Origin']).toBe(origin);
    expect(created.headers['Cache-Control']).toBe('no-store');
    await expect(validateAccess({ code: created.body.code, email }, { grants, secret: fingerprintKey })).resolves.toBeDefined();
    const listed = await send();
    expect(listed.body).toEqual({ grants: [{ shortId: created.body.shortId, note: 'Regalo', createdAt: now.toISOString(), status: 'active' }] });
  });

  it('revokes a code by its short id', async () => {
    const { send } = setUp();
    const { body } = await send({ method: 'POST', body: { email, note: 'Regalo' } });

    expect((await send({ method: 'POST', path: `/grants/${body.shortId}/revoke` })).statusCode).toBe(204);
    expect((await send()).body.grants[0].status).toBe('revoked');
  });

  it.each([
    ['a bad email', { method: 'POST', body: { email: 'no-es-correo', note: 'Nota' } }, 400, 'invalid_input'],
    ['no body', { method: 'POST' }, 400, 'invalid_input'],
    ['a malformed short id', { method: 'POST', path: '/grants/XYZ/revoke' }, 400, 'invalid_input'],
    ['an unknown short id', { method: 'POST', path: '/grants/abcdef12/revoke' }, 404, 'grant_not_found'],
    ['an unknown route', { path: '/codes' }, 404, 'not_found'],
    ['another method', { method: 'DELETE' }, 404, 'not_found'],
  ])('answers %s with %i', async (_case, request, status, error) => {
    const response = await setUp().send(request);

    expect([response.statusCode, response.body.error]).toEqual([status, error]);
  });

  it.each([
    ['list', {}],
    ['create', { method: 'POST', body: { email, note: 'Nota' } }],
    ['revoke', { method: 'POST', path: '/grants/abcdef12/revoke' }],
  ])('refuses to %s without an admin token', async (_action, request) => {
    const { grants, send } = setUp();

    for (const token of [null, 'other-token']) {
      const response = await send({ ...request, token });
      expect([response.statusCode, response.body]).toEqual([401, { error: 'not_admin' }]);
    }
    expect(grants.grants.size).toBe(0);
  });

  it.each([['https://otra-web.example'], [null]])('refuses requests from origin %s', async (from) => {
    const response = await setUp().send({ from });

    expect(response.statusCode).toBe(403);
    expect(response.headers['Access-Control-Allow-Origin']).toBeUndefined();
  });

  it('answers the CORS preflight with the Authorization header allowed', async () => {
    const response = await setUp().send({ method: 'OPTIONS', token: null });

    expect(response.statusCode).toBe(204);
    expect(response.headers['Access-Control-Allow-Methods']).toBe('GET, POST');
    expect(response.headers['Access-Control-Allow-Headers']).toBe('Authorization, Content-Type');
  });

  it('lets unexpected failures surface instead of hiding them', async () => {
    const broken = { ...createGrantStore(), list: async () => Promise.reject(new Error('firestore down')) };

    await expect(setUp({ grants: broken }).send()).rejects.toThrow('firestore down');
  });
});
