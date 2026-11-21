import { describe, expect, it } from 'vitest';
import { createDeviceStore, requestSession } from './access.js';

const session = { token: 'abc.def', expiresAt: '2026-11-19T12:00:00.000Z' };
const device = 'pass.tag';

const respondWith = (status, body = {}) => async (url, options) => {
  respondWith.calls.push({ url, options });
  return { status, json: async () => body };
};
respondWith.calls = [];

describe('requestSession', () => {
  it('posts the code and email as JSON and returns the session and the pass for this browser', async () => {
    const result = await requestSession({ code: 'K7QM-2XPA-9RTD', email: 'lectora@example.com' }, { fetch: respondWith(200, { ...session, device }), url: 'https://api.example/startSession' });

    expect(result).toEqual({ ok: true, session, device });
    expect(respondWith.calls.at(-1)).toEqual({
      url: 'https://api.example/startSession',
      options: { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"code":"K7QM-2XPA-9RTD","email":"lectora@example.com"}' },
    });
  });

  it('starts a session from the pass alone', async () => {
    const result = await requestSession({ device }, { fetch: respondWith(200, { ...session, device: 'renewed.tag' }) });

    expect(result).toEqual({ ok: true, session, device: 'renewed.tag' });
    expect(respondWith.calls.at(-1).options.body).toBe('{"device":"pass.tag"}');
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
    ['a session without pass', async () => ({ status: 200, json: async () => session })],
  ])('treats a 200 with %s as unavailable', async (_, send) => {
    expect(await requestSession({ code: 'x', email: 'y' }, { fetch: send })).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('reports a network failure as its own reason', async () => {
    const offline = async () => Promise.reject(new TypeError('Failed to fetch'));

    expect(await requestSession({ code: 'x', email: 'y' }, { fetch: offline })).toEqual({ ok: false, reason: 'network' });
  });
});

describe('createDeviceStore', () => {
  const createStorage = () => {
    const items = new Map();
    return { items, getItem: (key) => items.get(key) ?? null, setItem: (key, value) => items.set(key, value), removeItem: (key) => items.delete(key) };
  };

  it('keeps only the pass, and forgets it', () => {
    const storage = createStorage();
    const store = createDeviceStore(storage);

    store.save(device);
    expect([store.load(), [...storage.items.values()]]).toEqual([device, [device]]);
    store.forget();
    expect(store.load()).toBeNull();
  });

  it('remembers nothing when the browser blocks storage', () => {
    const refuse = () => {
      throw new Error('SecurityError');
    };
    const store = createDeviceStore({ getItem: refuse, setItem: refuse, removeItem: refuse });

    expect([store.save(device), store.load(), store.forget()]).toEqual([false, null, false]);
  });
});
