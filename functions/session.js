import { createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const KEY_MIN_LENGTH = 32;

/** Single error for every refused session, so callers cannot tell why it failed. */
export class SessionError extends Error {
  constructor() {
    super('Invalid session');
    this.name = 'SessionError';
  }
}

const assertKey = (key) => {
  if (typeof key !== 'string' || key.length < KEY_MIN_LENGTH) {
    throw new Error(`The session key must have at least ${KEY_MIN_LENGTH} characters`);
  }
};

const sign = (key, payload) => createHmac('sha256', key).update(payload).digest('base64url');

const readPayload = (token, key) => {
  const [payload, tag, ...rest] = typeof token === 'string' ? token.split('.') : [];
  if (!payload || !tag || rest.length > 0) throw new SessionError();
  const expected = Buffer.from(sign(key, payload));
  const received = Buffer.from(tag);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) throw new SessionError();
  // Only reached with our own signature, so the payload is JSON we wrote.
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
};

/**
 * Issues a stateless session token for a validated grant.
 * @returns {{token: string, expiresAt: Date}}
 */
export const issueSession = (grantId, { key, now }) => {
  assertKey(key);
  const expiresAt = now.getTime() + SESSION_TTL_MS;
  const payload = Buffer.from(JSON.stringify({ grantId, expiresAt })).toString('base64url');
  return { token: `${payload}.${sign(key, payload)}`, expiresAt: new Date(expiresAt) };
};

/**
 * Accepts a session only with a valid signature, before its expiry and while its grant is still active.
 * @returns {Promise<{grantId: string, expiresAt: Date}>}
 * @throws {SessionError}
 */
export const verifySession = async (token, { key, now, grants }) => {
  assertKey(key);
  const { grantId, expiresAt } = readPayload(token, key);
  if (expiresAt <= now.getTime()) throw new SessionError();
  const grant = await grants.get(grantId);
  if (grant?.revoked !== false) throw new SessionError();
  return { grantId, expiresAt: new Date(expiresAt) };
};
