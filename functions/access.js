import { createHmac, timingSafeEqual } from 'node:crypto';

const EMAIL_MAX_LENGTH = 254;
const WHITESPACE = /\s/;
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

// Linear check (no backtracking regex): one "@", a local part, and a domain with an inner dot.
const isEmail = (email) => {
  const at = email.indexOf('@');
  const domain = email.slice(at + 1);
  const dot = domain.lastIndexOf('.');
  return at > 0 && at === email.lastIndexOf('@') && dot > 0 && dot < domain.length - 1 && !WHITESPACE.test(email);
};

const normaliseEmail = (value) => {
  if (typeof value !== 'string') throw new AccessDeniedError();
  const email = value.normalize('NFC').trim().toLowerCase();
  if (email.length > EMAIL_MAX_LENGTH || !isEmail(email)) throw new AccessDeniedError();
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
 * Builds the Firestore document for a new grant. The code is never kept, only its keyed fingerprint as the id.
 * The email is kept so the admin knows who has each code; access is still checked against its fingerprint.
 * @param {{code: string, email: string}} access
 * @param {{secret: string, now: Date}} options
 * @returns {{id: string, record: {email: string, emailFingerprint: string, revoked: boolean, createdAt: Date}}}
 */
export const createGrantRecord = ({ code, email }, { secret, now }) => {
  assertSecret(secret);
  const normalisedEmail = normaliseEmail(email);
  return {
    id: fingerprint(secret, normaliseCode(code)),
    record: { email: normalisedEmail, emailFingerprint: fingerprint(secret, normalisedEmail), revoked: false, createdAt: now },
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
