import { deriveChapterKey } from './packaging.js';
import { parseMediaPath, rewritePlaylist } from './playback.js';
import { SessionError, verifySession } from './session.js';
import { ALLOWED_ORIGINS } from './start-session.js';

const CONTENT_TYPES = {
  catalog: 'application/json',
  playlist: 'application/vnd.apple.mpegurl',
  key: 'application/octet-stream',
  segment: 'video/mp2t',
};

const refuse = (response, status, error) => response.status(status).json({ error });

const sendResource = (response, kind, body) => response.status(200).set('Content-Type', CONTENT_TYPES[kind]).send(body);

const hasValidSession = async (token, { grants, sessionKey, now }) => {
  try {
    await verifySession(typeof token === 'string' ? token : undefined, { key: sessionKey(), now: now(), grants });
    return true;
  } catch (error) {
    if (error instanceof SessionError) return false;
    throw error;
  }
};

/**
 * HTTP handler for GET audio resources (catalog, chapter playlist, key, segment) with ?session=.
 * Requests without Origin are allowed because native Safari HLS sends none; the session protects them.
 * @param {{grants: object, media: {read: (object: string) => Promise<Buffer | null>}, sessionKey: () => string, mediaKey: () => string, now: () => Date}} deps
 */
export const createPlaybackHandler =
  ({ grants, media, sessionKey, mediaKey, now }) =>
  async (request, response) => {
    response.set('Cache-Control', 'private, no-store');
    const origin = request.get('origin');
    if (origin !== undefined) {
      if (!ALLOWED_ORIGINS.has(origin)) return refuse(response, 403, 'forbidden_origin');
      response.set('Access-Control-Allow-Origin', origin).set('Vary', 'Origin');
    }
    if (request.method !== 'GET') return refuse(response, 405, 'method_not_allowed');

    const route = parseMediaPath(request.path);
    if (!route) return refuse(response, 404, 'not_found');
    const token = request.query.session;
    if (!(await hasValidSession(token, { grants, sessionKey, now }))) return refuse(response, 401, 'invalid_session');

    if (route.kind === 'key') return sendResource(response, 'key', deriveChapterKey(mediaKey(), route.id));
    const body = await media.read(route.object);
    if (body === null) return refuse(response, 404, 'not_found');
    if (route.kind === 'playlist') return sendResource(response, 'playlist', rewritePlaylist(body.toString('utf8'), token));
    return sendResource(response, route.kind, body);
  };
