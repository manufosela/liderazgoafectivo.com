import { AccessDeniedError, validateAccess } from './access.js';
import { TooManyAttemptsError, attemptKeys } from './attempts.js';
import { SessionError, issueDevicePass, issueSession, verifyDevicePass } from './session.js';

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

/** A new session and a renewed device pass, so a browser that keeps listening never has to type the code again. */
const grantAccess = (response, grantId, options) => {
  const session = issueSession(grantId, options);
  const device = issueDevicePass(grantId, options);
  return response.status(200).json({ token: session.token, expiresAt: session.expiresAt.toISOString(), device: device.token });
};

/**
 * HTTP handler: POST {code, email} or {device} from an allowed origin returns {token, expiresAt, device}.
 * Every refusal of a code or a pass is the same 401; code attempts beyond the limit get 429.
 * A pass is signed by the server, so it cannot be guessed and does not count attempts.
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

    const { code, email, device } = request.body ?? {};
    const current = now();
    const tokens = { key: sessionKey(), now: current };

    if (typeof device === 'string') {
      try {
        const { grantId } = await verifyDevicePass(device, { ...tokens, grants });
        return grantAccess(response, grantId, tokens);
      } catch (error) {
        if (error instanceof SessionError) return refuse(response, 401, 'access_denied');
        throw error;
      }
    }

    const keys = attemptKeys({ ip: request.ip, code }, fingerprintKey());
    if (!(await reserveAttempt(limiter, keys, current))) return refuse(response, 429, 'too_many_attempts');

    try {
      const { grantId } = await validateAccess({ code, email }, { grants, secret: fingerprintKey() });
      await limiter.release(keys, current);
      return grantAccess(response, grantId, tokens);
    } catch (error) {
      if (error instanceof AccessDeniedError) return refuse(response, 401, 'access_denied');
      throw error;
    }
  };
