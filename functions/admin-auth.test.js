import { describe, expect, it } from 'vitest';
import { NotAdminError, createAdminVerifier, parseAdminEmails } from './admin-auth.js';

const admin = 'autor@example.com';
const googleClaims = { email: admin, email_verified: true, firebase: { sign_in_provider: 'google.com' } };

const tokenError = (code) => Object.assign(new Error(code), { code });

const setUp = ({ claims = googleClaims, list = ` ${admin.toUpperCase()} , otra@example.com` } = {}) => {
  const calls = [];
  const verifyAdmin = createAdminVerifier({
    verifyIdToken: async (token, checkRevoked) => {
      calls.push([token, checkRevoked]);
      if (claims instanceof Error) throw claims;
      return claims;
    },
    adminEmails: () => list,
  });
  return { verifyAdmin, calls };
};

describe('parseAdminEmails', () => {
  it('trims and lowercases the comma separated list', () => {
    expect([...parseAdminEmails(' Uno@Example.com,, dos@example.com ')]).toEqual(['uno@example.com', 'dos@example.com']);
  });

  it.each([[''], [' , '], [undefined]])('fails loudly on an empty list %o', (list) => {
    expect(() => parseAdminEmails(list)).toThrow(/AUDIOBOOK_ADMIN_EMAILS/);
  });
});

describe('verifyAdmin', () => {
  it('returns the email of a listed admin signed in with Google, checking revocation', async () => {
    const { verifyAdmin, calls } = setUp();

    await expect(verifyAdmin('Bearer id-token')).resolves.toBe(admin);
    expect(calls).toEqual([['id-token', true]]);
  });

  it.each([[undefined], [''], ['Basic abc'], ['Bearer '], ['bearer id-token']])('refuses the header %o without verifying it', async (header) => {
    const { verifyAdmin, calls } = setUp();

    await expect(verifyAdmin(header)).rejects.toBeInstanceOf(NotAdminError);
    expect(calls).toEqual([]);
  });

  it.each([['auth/id-token-expired'], ['auth/id-token-revoked'], ['auth/argument-error'], ['auth/user-disabled']])('refuses a token rejected with %s', async (code) => {
    await expect(setUp({ claims: tokenError(code) }).verifyAdmin('Bearer id-token')).rejects.toBeInstanceOf(NotAdminError);
  });

  it('lets other verification failures surface', async () => {
    const { verifyAdmin } = setUp({ claims: tokenError('auth/internal-error') });

    await expect(verifyAdmin('Bearer id-token')).rejects.toThrow('auth/internal-error');
    await expect(verifyAdmin('Bearer id-token')).rejects.not.toBeInstanceOf(NotAdminError);
  });

  it.each([
    ['an unverified email', { ...googleClaims, email_verified: false }],
    ['another provider', { ...googleClaims, firebase: { sign_in_provider: 'password' } }],
    ['an email outside the list', { ...googleClaims, email: 'intrusa@example.com' }],
    ['no email', { ...googleClaims, email: undefined }],
  ])('refuses %s', async (_case, claims) => {
    await expect(setUp({ claims }).verifyAdmin('Bearer id-token')).rejects.toBeInstanceOf(NotAdminError);
  });

  it('fails loudly when the admin list is not configured', async () => {
    const { verifyAdmin } = setUp({ list: '' });

    await expect(verifyAdmin('Bearer id-token')).rejects.not.toBeInstanceOf(NotAdminError);
  });
});
