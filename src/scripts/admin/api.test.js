import { describe, expect, it } from 'vitest';
import { ADMIN_URL, AdminRequestError, createAdminApi } from './api.js';

const base = 'https://admin.example';

const reply = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });

const setUp = (answer) => {
  const calls = [];
  const api = createAdminApi({
    getToken: async () => 'id-token',
    base,
    fetch: async (url, options) => {
      calls.push([url, options]);
      if (answer instanceof Error) throw answer;
      return answer;
    },
  });
  return { api, calls };
};

const reasonOf = async (promise) => promise.then(() => 'resolved', (error) => (error instanceof AdminRequestError ? error.reason : error));

describe('admin api', () => {
  it('points at the admin function in Europe', () => {
    expect(ADMIN_URL).toBe('https://europe-west1-comunidad-liderazgoafectivo.cloudfunctions.net/admin');
  });

  it('lists the codes with the ID token and real dates', async () => {
    const grant = { shortId: 'abcd1234', note: 'Regalo', createdAt: '2026-11-21T10:00:00.000Z', status: 'active' };
    const { api, calls } = setUp(reply(200, { grants: [grant] }));

    expect(await api.listGrants()).toEqual([{ ...grant, createdAt: new Date(grant.createdAt) }]);
    expect(calls).toEqual([[`${base}/grants`, { method: 'GET', headers: { Authorization: 'Bearer id-token' }, body: undefined }]]);
  });

  it('creates a code sending the email and the note as JSON', async () => {
    const { api, calls } = setUp(reply(201, { code: 'AAAA-BBBB-CCCC', shortId: 'abcd1234' }));

    expect(await api.createGrant({ email: 'lectora@example.com', note: 'Regalo' })).toEqual({ code: 'AAAA-BBBB-CCCC', shortId: 'abcd1234' });
    expect(calls[0][1]).toEqual({
      method: 'POST',
      headers: { Authorization: 'Bearer id-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'lectora@example.com', note: 'Regalo' }),
    });
  });

  it('revokes a code by its short id', async () => {
    const { api, calls } = setUp(reply(204));

    await expect(api.revokeGrant('abcd1234')).resolves.toBeNull();
    expect(calls[0][0]).toBe(`${base}/grants/abcd1234/revoke`);
  });

  it.each([
    [reply(401, { error: 'not_admin' }), 'notAdmin'],
    [reply(400, { error: 'invalid_input' }), 'invalidInput'],
    [reply(404, { error: 'grant_not_found' }), 'notFound'],
    [reply(500), 'unavailable'],
    [new TypeError('Failed to fetch'), 'network'],
  ])('turns %o into the reason %s', async (answer, reason) => {
    expect(await reasonOf(setUp(answer).api.listGrants())).toBe(reason);
  });

  it('treats an unexpected list body as unavailable', async () => {
    expect(await reasonOf(setUp(reply(200, { nope: true })).api.listGrants())).toBe('unavailable');
  });
});
