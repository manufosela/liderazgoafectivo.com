import { describe, expect, it } from 'vitest';
import { createGrantRecord } from './access.js';
import { deriveChapterKey } from './packaging.js';
import { createPlaybackHandler } from './playback-handler.js';
import { SESSION_TTL_MS, issueSession } from './session.js';

const sessionKey = 'session-key-with-at-least-32-characters';
const mediaKey = 'media-key-with-at-least-32-characters';
const now = new Date('2026-11-19T10:00:00Z');
const playlist = '#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="chapter.key"\n#EXTINF:10.0,\nseg-0000.ts\n#EXT-X-ENDLIST\n';

const setUp = ({ revoked = false, clock = now } = {}) => {
  const { id, record } = createGrantRecord({ code: 'K7QM-2XPA-9RTD', email: 'lectora@example.com' }, { secret: 'f'.repeat(32), now });
  const grants = { get: async (grantId) => (grantId === id ? { ...record, revoked } : null) };
  const objects = new Map([
    ['catalog.json', Buffer.from('{"chapters":[]}')],
    ['chapters/001/index.m3u8', Buffer.from(playlist)],
    ['chapters/001/seg-0000.ts', Buffer.from('encrypted-bytes')],
  ]);
  const reads = [];
  const media = {
    read: async (object) => {
      reads.push(object);
      return objects.get(object) ?? null;
    },
  };
  const handler = createPlaybackHandler({ grants, media, sessionKey: () => sessionKey, mediaKey: () => mediaKey, now: () => clock });
  const { token } = issueSession(id, { key: sessionKey, now });
  const send = async (path, { session = token, withoutSession = false, method = 'GET', origin = undefined } = {}) => {
    const response = { headers: {} };
    response.status = (code) => Object.assign(response, { statusCode: code });
    response.set = (name, value) => Object.assign(response, { headers: { ...response.headers, [name]: value } });
    response.send = (body) => Object.assign(response, { body });
    response.json = (body) => Object.assign(response, { body });
    await handler({ method, path, query: withoutSession ? {} : { session }, get: (name) => (name === 'origin' ? origin : undefined) }, response);
    return response;
  };
  return { token, reads, send };
};

const mediaPaths = ['/catalog', '/chapters/001/index.m3u8', '/chapters/001/key', '/chapters/001/seg-0000.ts'];

describe('playback handler', () => {
  it('serves catalog, rewritten playlist, chapter key and segment to a valid session, never cacheable', async () => {
    const { token, send } = setUp();

    const [catalog, chapterPlaylist, key, segment] = await Promise.all(mediaPaths.map((path) => send(path)));

    expect(catalog.body.toString()).toBe('{"chapters":[]}');
    expect(chapterPlaylist.body).toContain(`URI="key?session=${token}"`);
    expect(chapterPlaylist.headers['Content-Type']).toBe('application/vnd.apple.mpegurl');
    expect(key.body.equals(deriveChapterKey(mediaKey, '001'))).toBe(true);
    expect(segment.body.toString()).toBe('encrypted-bytes');
    for (const response of [catalog, chapterPlaylist, key, segment]) {
      expect(response.statusCode).toBe(200);
      expect(response.headers['Cache-Control']).toBe('private, no-store');
    }
  });

  it.each([
    ['expired', () => setUp({ clock: new Date(now.getTime() + SESSION_TTL_MS) }), {}],
    ['revoked', () => setUp({ revoked: true }), {}],
    ['tampered', () => setUp(), { session: 'x.y' }],
    ['missing', () => setUp(), { withoutSession: true }],
  ])('answers a %s session without audio or key', async (_, build, options) => {
    const { send, reads } = build();

    for (const path of mediaPaths) {
      const response = await send(path, options);
      expect([response.statusCode, response.body]).toEqual([401, { error: 'invalid_session' }]);
    }
    expect(reads).toEqual([]);
  });

  it('refuses unknown or manipulated paths without touching the bucket', async () => {
    const { send, reads } = setUp();

    for (const path of ['/chapters/../catalog.json', '/chapters/001/other.ts', '/chapters/002/seg-0000.ts']) {
      expect((await send(path)).statusCode).toBe(404);
    }
    expect(reads).toEqual(['chapters/002/seg-0000.ts']);
  });

  it('lets a database failure surface instead of answering it as an invalid session', async () => {
    const handler = createPlaybackHandler({
      grants: { get: async () => Promise.reject(new Error('firestore down')) },
      media: { read: async () => null },
      sessionKey: () => sessionKey,
      mediaKey: () => mediaKey,
      now: () => now,
    });
    const { token } = issueSession('a'.repeat(64), { key: sessionKey, now });
    const response = { set: () => response };

    await expect(handler({ method: 'GET', path: '/catalog', query: { session: token }, get: () => undefined }, response)).rejects.toThrow('firestore down');
  });

  it('accepts requests without Origin (native Safari) or from the book site, and refuses other sites and methods', async () => {
    const { send } = setUp();

    expect((await send('/catalog', { origin: 'https://liderazgoafectivo.com' })).headers['Access-Control-Allow-Origin']).toBe('https://liderazgoafectivo.com');
    expect((await send('/catalog', { origin: 'https://otra-web.example' })).statusCode).toBe(403);
    expect((await send('/catalog', { method: 'POST' })).statusCode).toBe(405);
  });
});
