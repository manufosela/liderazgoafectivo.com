import { describe, expect, it, vi } from 'vitest';

const database = vi.hoisted(() => ({ opened: 0 }));

vi.mock('firebase-functions/v2/https', () => ({ onRequest: (options, handler) => Object.assign(handler, { options }) }));
vi.mock('firebase-functions/params', () => ({
  defineSecret: (name) => ({ name, value: () => `${name}-value-with-at-least-32-characters` }),
}));
vi.mock('./database.js', () => ({
  getAudiobookDatabase: () => {
    database.opened += 1;
    return { collection: () => ({ doc: () => ({}) }) };
  },
}));

const { startSession } = await import('./index.js');

const respond = () => {
  const response = { headers: {} };
  response.status = (code) => Object.assign(response, { statusCode: code });
  response.json = (body) => Object.assign(response, { body });
  response.set = (name, value) => Object.assign(response, { headers: { ...response.headers, [name]: value } });
  return response;
};

describe('startSession function', () => {
  it('runs in Europe with both secrets and only public HTTPS access', () => {
    expect(startSession.options).toMatchObject({ region: 'europe-west1', invoker: 'public' });
    expect(startSession.options.secrets.map(({ name }) => name)).toEqual(['AUDIOBOOK_FINGERPRINT_KEY', 'AUDIOBOOK_SESSION_KEY']);
  });

  it('builds the handler once over the audiolibro database and serves requests', async () => {
    const request = { method: 'POST', get: () => 'https://otra-web.example' };

    const first = await startSession(request, respond());
    await startSession(request, respond());

    expect(first.statusCode).toBe(403);
    expect(database.opened).toBe(1);
  });
});
