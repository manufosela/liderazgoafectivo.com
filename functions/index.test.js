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
vi.mock('./media-store.js', () => ({
  getAudiobookBucket: () => {
    database.buckets = (database.buckets ?? 0) + 1;
    return {};
  },
  createBucketMediaStore: () => ({ read: async () => null }),
}));

const { audio, startSession } = await import('./index.js');

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

describe('audio function', () => {
  it('runs in Europe with the session and media keys', () => {
    expect(audio.options).toMatchObject({ region: 'europe-west1', invoker: 'public' });
    expect(audio.options.secrets.map(({ name }) => name)).toEqual(['AUDIOBOOK_SESSION_KEY', 'AUDIOBOOK_MEDIA_KEY']);
  });

  it('builds the handler once over the bucket and refuses requests without a session', async () => {
    const request = { method: 'GET', path: '/catalog', query: {}, get: () => undefined };

    const first = await audio(request, respond());
    await audio(request, respond());

    expect(first.statusCode).toBe(401);
    expect(first.headers['Cache-Control']).toBe('private, no-store');
    expect(database.buckets).toBe(1);
  });
});
