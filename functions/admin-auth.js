const BEARER = 'Bearer ';

// Codes firebase-admin gives to a token that is bad, old or from a disabled user; anything else is an outage and surfaces.
const REJECTED_TOKEN_CODES = new Set([
  'auth/argument-error',
  'auth/id-token-expired',
  'auth/id-token-revoked',
  'auth/invalid-id-token',
  'auth/user-disabled',
  'auth/user-not-found',
]);

/** The request does not come from an audiobook admin; always answered with the same 401. */
export class NotAdminError extends Error {
  constructor(reason) {
    super(`Not an audiobook admin: ${reason}`);
    this.name = 'NotAdminError';
  }
}

/** Admin emails from the comma separated secret; an empty list is a misconfiguration, never "nobody". */
export const parseAdminEmails = (list) => {
  const emails = new Set(
    String(list ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
  if (emails.size === 0) throw new Error('AUDIOBOOK_ADMIN_EMAILS has no email');
  return emails;
};

const readToken = (authorization) => {
  if (typeof authorization !== 'string' || !authorization.startsWith(BEARER)) throw new NotAdminError('no bearer token');
  const token = authorization.slice(BEARER.length).trim();
  if (!token) throw new NotAdminError('empty token');
  return token;
};

const decode = async (verifyIdToken, token) => {
  try {
    return await verifyIdToken(token, true);
  } catch (error) {
    if (REJECTED_TOKEN_CODES.has(error?.code)) throw new NotAdminError(error.code);
    throw error;
  }
};

/**
 * Checks the Authorization header of an admin request: a Firebase ID token, not revoked, of a verified
 * email signed in with Google that is in the audiobook admin list.
 * @param {{verifyIdToken: (token: string, checkRevoked: boolean) => Promise<object>, adminEmails: () => string}} deps
 * @returns {(authorization: string | undefined) => Promise<string>} the admin email
 */
export const createAdminVerifier =
  ({ verifyIdToken, adminEmails }) =>
  async (authorization) => {
    const admins = parseAdminEmails(adminEmails());
    const claims = await decode(verifyIdToken, readToken(authorization));
    if (claims.firebase?.sign_in_provider !== 'google.com') throw new NotAdminError('not signed in with Google');
    const email = typeof claims.email === 'string' ? claims.email.toLowerCase() : '';
    if (claims.email_verified !== true || !admins.has(email)) throw new NotAdminError('email not allowed');
    return email;
  };
