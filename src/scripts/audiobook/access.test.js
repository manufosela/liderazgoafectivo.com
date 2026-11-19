import { describe, expect, it } from 'vitest';
import { requestSession } from './access.js';

const session = { token: 'abc.def', expiresAt: '2026-11-19T12:00:00.000Z' };

const respondWith = (status, body = {}) => async (url, options) => {
  respondWith.calls.push({ url, options });
  return { status, json: async () => body };
};
respondWith.calls = [];

describe('requestSession', () => {
  it('posts the code and email as JSON and returns the session', async () => {
    const result = await requestSession({ code: 'K7QM-2XPA-9RTD', email: 'lectora@example.com' }, { fetch: respondWith(200, session), url: 'https://api.example/startSession' });

    expect(result).toEqual({ ok: true, session });
    expect(respondWith.calls.at(-1)).toEqual({
      url: 'https://api.example/startSession',
      options: { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"code":"K7QM-2XPA-9RTD","email":"lectora@example.com"}' },
    });
  });

  it.each([
    [401, 'accessDenied'],
    [429, 'tooManyAttempts'],
    [403, 'unavailable'],
    [500, 'unavailable'],
  ])('turns status %i into the generic reason %s', async (status, reason) => {
    expect(await requestSession({ code: 'x', email: 'y' }, { fetch: respondWith(status) })).toEqual({ ok: false, reason });
  });

  it.each([
    ['a body that is not JSON', async () => ({ status: 200, json: async () => Promise.reject(new SyntaxError('Unexpected token')) })],
    ['an incomplete session', async () => ({ status: 200, json: async () => ({ token: 'abc.def' }) })],
  ])('treats a 200 with %s as unavailable', async (_, send) => {
    expect(await requestSession({ code: 'x', email: 'y' }, { fetch: send })).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('reports a network failure as its own reason', async () => {
    const offline = async () => Promise.reject(new TypeError('Failed to fetch'));

    expect(await requestSession({ code: 'x', email: 'y' }, { fetch: offline })).toEqual({ ok: false, reason: 'network' });
  });
});
