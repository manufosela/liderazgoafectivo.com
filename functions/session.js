import { createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
/** A browser that keeps listening keeps its pass: each use renews it for another year. */
export const DEVICE_TTL_MS = 365 * 24 * 60 * 60 * 1000;
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

// Every token says what it is for, so a device pass never stands in for a session nor the other way round.
const issueToken = (use, ttl) => (grantId, { key, now }) => {
  assertKey(key);
  const expiresAt = now.getTime() + ttl;
  const payload = Buffer.from(JSON.stringify({ use, grantId, expiresAt })).toString('base64url');
  return { token: `${payload}.${sign(key, payload)}`, expiresAt: new Date(expiresAt) };
};

const verifyToken = (expectedUse) => async (token, { key, now, grants }) => {
  assertKey(key);
  // Tokens issued before they said their use are two-hour sessions, so they keep working until they expire.
  const { use = 'session', grantId, expiresAt } = readPayload(token, key);
  if (use !== expectedUse || expiresAt <= now.getTime()) throw new SessionError();
  const grant = await grants.get(grantId);
  if (grant?.revoked !== false) throw new SessionError();
  return { grantId, expiresAt: new Date(expiresAt) };
};

/**
 * Issues a stateless two-hour listening session for a validated grant.
 * @type {(grantId: string, options: {key: string, now: Date}) => {token: string, expiresAt: Date}}
 */
export const issueSession = issueToken('session', SESSION_TTL_MS);

/**
 * Accepts a session only with a valid signature, before its expiry and while its grant is still active.
 * @type {(token: string, options: {key: string, now: Date, grants: object}) => Promise<{grantId: string, expiresAt: Date}>}
 * @throws {SessionError}
 */
export const verifySession = verifyToken('session');

/**
 * Issues the pass a browser keeps to start new sessions without the code again.
 * @type {(grantId: string, options: {key: string, now: Date}) => {token: string, expiresAt: Date}}
 */
export const issueDevicePass = issueToken('device', DEVICE_TTL_MS);

/**
 * Accepts a device pass on the same terms as a session: signature, expiry and an active grant.
 * @type {(token: string, options: {key: string, now: Date, grants: object}) => Promise<{grantId: string, expiresAt: Date}>}
 * @throws {SessionError}
 */
export const verifyDevicePass = verifyToken('device');
