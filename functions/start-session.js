import { AccessDeniedError, validateAccess } from './access.js';
import { TooManyAttemptsError, attemptKeys } from './attempts.js';
import { issueSession } from './session.js';

/** Only the book's own website may start a listening session. */
export const ALLOWED_ORIGINS = new Set(['https://liderazgoafectivo.com', 'https://www.liderazgoafectivo.com']);

const refuse = (response, status, error) => response.status(status).json({ error });

const reserveAttempt = async (limiter, keys, now) => {
  try {
    await limiter.reserve(keys, now);
    return true;
  } catch (error) {
    if (error instanceof TooManyAttemptsError) return false;
    throw error;
  }
};

/**
 * HTTP handler: POST {code, email} from an allowed origin returns {token, expiresAt}.
 * Every refusal of a code is the same 401, attempts beyond the limit get 429.
 * @param {{grants: object, limiter: object, fingerprintKey: () => string, sessionKey: () => string, now: () => Date}} deps
 */
export const createStartSessionHandler =
  ({ grants, limiter, fingerprintKey, sessionKey, now }) =>
  async (request, response) => {
    const origin = request.get('origin');
    if (!ALLOWED_ORIGINS.has(origin)) return refuse(response, 403, 'forbidden_origin');
    response.set('Access-Control-Allow-Origin', origin).set('Vary', 'Origin');

    if (request.method === 'OPTIONS') {
      response.set('Access-Control-Allow-Methods', 'POST').set('Access-Control-Allow-Headers', 'Content-Type').set('Access-Control-Max-Age', '3600');
      return response.status(204).send('');
    }
    if (request.method !== 'POST') return refuse(response, 405, 'method_not_allowed');

    const { code, email } = request.body ?? {};
    const current = now();
    const keys = attemptKeys({ ip: request.ip, code }, fingerprintKey());
    if (!(await reserveAttempt(limiter, keys, current))) return refuse(response, 429, 'too_many_attempts');

    try {
      const { grantId } = await validateAccess({ code, email }, { grants, secret: fingerprintKey() });
      await limiter.release(keys, current);
      const session = issueSession(grantId, { key: sessionKey(), now: current });
      return response.status(200).json({ token: session.token, expiresAt: session.expiresAt.toISOString() });
    } catch (error) {
      if (error instanceof AccessDeniedError) return refuse(response, 401, 'access_denied');
      throw error;
    }
  };
