import { describe, expect, it } from 'vitest';
import { createAttemptLimiter } from './attempts.js';
import { createGrant } from './grants-admin.js';
import { verifySession } from './session.js';
import { createStartSessionHandler } from './start-session.js';

const fingerprintKey = 'fingerprint-key-with-at-least-32-chars';
const sessionKey = 'session-key-with-at-least-32-characters';
const origin = 'https://liderazgoafectivo.com';
const email = 'lectora@example.com';
const now = new Date('2026-11-19T10:00:00Z');

const createGrantStore = () => {
  const grants = new Map();
  return {
    get: async (id) => grants.get(id) ?? null,
    create: async (id, record) => grants.set(id, record),
  };
};

const createAttemptStore = () => {
  const records = new Map();
  return {
    records,
    transact: async (keys, change) => {
      const updated = change(keys.map((key) => records.get(key) ?? null));
      keys.forEach((key, index) => records.set(key, updated[index]));
    },
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

const setUp = async ({ grants = createGrantStore(), attempts = createAttemptStore() } = {}) => {
  const { code } = await createGrant({ email, note: 'Prueba' }, { grants, secret: fingerprintKey, now });
  const handler = createStartSessionHandler({
    grants,
    limiter: createAttemptLimiter(attempts),
    fingerprintKey: () => fingerprintKey,
    sessionKey: () => sessionKey,
    now: () => now,
  });
  const send = async ({ method = 'POST', from = origin, body = { code, email } } = {}) => {
    const response = createResponse();
    await handler({ method, ip: '203.0.113.7', body, get: (name) => (name === 'origin' ? from : undefined) }, response);
    return response;
  };
  return { code, grants, attempts, send };
};

describe('startSession handler', () => {
  it('returns a two-hour session for the right code and email, and frees the attempt', async () => {
    const { grants, attempts, send } = await setUp();

    const response = await send();

    expect(response.statusCode).toBe(200);
    expect(response.headers['Access-Control-Allow-Origin']).toBe(origin);
    expect(response.body.expiresAt).toBe('2026-11-19T12:00:00.000Z');
    await expect(verifySession(response.body.token, { key: sessionKey, now, grants })).resolves.toBeDefined();
    expect([...attempts.records.values()].map(({ count }) => count)).toEqual([0, 0]);
  });

  it('answers a wrong email with the generic error and blocks after five failures', async () => {
    const { code, send } = await setUp();
    const wrong = { code, email: 'otra@example.com' };

    const failures = [];
    for (let attempt = 0; attempt < 5; attempt += 1) failures.push(await send({ body: wrong }));

    expect(failures.map(({ statusCode, body }) => [statusCode, body.error])).toEqual(Array(5).fill([401, 'access_denied']));
    expect((await send()).statusCode).toBe(429);
  });

  it('answers a request without body with the same generic error', async () => {
    const { send } = await setUp();

    expect((await send({ body: null })).body).toEqual({ error: 'access_denied' });
  });

  it.each([['https://otra-web.example'], [null]])('refuses requests from origin %s', async (from) => {
    const { send } = await setUp();

    const response = await send({ from });

    expect(response.statusCode).toBe(403);
    expect(response.headers['Access-Control-Allow-Origin']).toBeUndefined();
  });

  it('answers the CORS preflight and refuses other methods', async () => {
    const { send } = await setUp();

    const preflight = await send({ method: 'OPTIONS' });
    expect(preflight.statusCode).toBe(204);
    expect(preflight.headers['Access-Control-Allow-Methods']).toBe('POST');
    expect((await send({ method: 'GET' })).statusCode).toBe(405);
  });

  it('lets unexpected failures surface instead of hiding them', async () => {
    const brokenGrants = { ...createGrantStore(), get: async () => Promise.reject(new Error('firestore down')) };
    const brokenAttempts = { transact: async () => Promise.reject(new Error('firestore down')) };

    await expect((await setUp({ grants: brokenGrants })).send()).rejects.toThrow('firestore down');
    await expect((await setUp({ attempts: brokenAttempts })).send()).rejects.toThrow('firestore down');
  });
});
