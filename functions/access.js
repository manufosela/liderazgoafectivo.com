import { createHmac, timingSafeEqual } from 'node:crypto';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX_LENGTH = 254;
const CODE_PATTERN = /^[A-Z0-9]{12}$/;
const SECRET_MIN_LENGTH = 32;

/** Single error for every refused access, so callers cannot tell why it failed. */
export class AccessDeniedError extends Error {
  constructor() {
    super('Access denied');
    this.name = 'AccessDeniedError';
  }
}

const assertSecret = (secret) => {
  if (typeof secret !== 'string' || secret.length < SECRET_MIN_LENGTH) {
    throw new Error(`The fingerprint secret must have at least ${SECRET_MIN_LENGTH} characters`);
  }
};

const normaliseEmail = (value) => {
  if (typeof value !== 'string') throw new AccessDeniedError();
  const email = value.normalize('NFC').trim().toLowerCase();
  if (email.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(email)) throw new AccessDeniedError();
  return email;
};

const normaliseCode = (value) => {
  if (typeof value !== 'string') throw new AccessDeniedError();
  const code = value.replaceAll(/[\s-]/g, '').toUpperCase();
  if (!CODE_PATTERN.test(code)) throw new AccessDeniedError();
  return code;
};

const fingerprint = (secret, value) => createHmac('sha256', secret).update(value).digest('hex');

const sameFingerprint = (stored, candidate) =>
  typeof stored === 'string' && stored.length === candidate.length && timingSafeEqual(Buffer.from(stored), Buffer.from(candidate));

/**
 * Builds the Firestore document for a new grant: only keyed fingerprints, never the code or the email.
 * @param {{code: string, email: string}} access
 * @param {{secret: string, now: Date}} options
 * @returns {{id: string, record: {emailFingerprint: string, revoked: boolean, createdAt: Date}}}
 */
export const createGrantRecord = ({ code, email }, { secret, now }) => {
  assertSecret(secret);
  return {
    id: fingerprint(secret, normaliseCode(code)),
    record: { emailFingerprint: fingerprint(secret, normaliseEmail(email)), revoked: false, createdAt: now },
  };
};

/**
 * Accepts a code only together with the email it was given to and only while it is not revoked.
 * @param {{code: unknown, email: unknown}} access
 * @param {{grants: {get: (id: string) => Promise<object | null>}, secret: string}} options
 * @returns {Promise<{grantId: string}>}
 * @throws {AccessDeniedError} for any unknown, mismatched, revoked or malformed access
 */
export const validateAccess = async ({ code, email }, { grants, secret }) => {
  assertSecret(secret);
  const grantId = fingerprint(secret, normaliseCode(code));
  const emailFingerprint = fingerprint(secret, normaliseEmail(email));
  const grant = await grants.get(grantId);
  if (grant?.revoked !== false || !sameFingerprint(grant.emailFingerprint, emailFingerprint)) {
    throw new AccessDeniedError();
  }
  return { grantId };
};
