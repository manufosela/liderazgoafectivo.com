import { describe, expect, it } from 'vitest';
import { AccessDeniedError, createGrantRecord, validateAccess } from './access.js';

const secret = 'test-secret-with-at-least-32-characters';
const code = 'K7QM-2XPA-9RTD';
const email = 'Lectora@Example.com';

const createGrantStore = (entries = []) => {
  const grants = new Map(entries);
  return { get: async (id) => grants.get(id) ?? null };
};

const storeWithGrant = (overrides = {}) => {
  const { id, record } = createGrantRecord({ code, email }, { secret, now: new Date('2026-11-19T00:00:00Z') });
  return createGrantStore([[id, { ...record, ...overrides }]]);
};

const deniedError = async (promise) => {
  const error = await promise.catch((caught) => caught);
  expect(error).toBeInstanceOf(AccessDeniedError);
  return error.message;
};

describe('validateAccess', () => {
  it('accepts the code with its email, ignoring case and surrounding spaces', async () => {
    const grants = storeWithGrant();

    const result = await validateAccess({ code: ' k7qm2xpa9rtd ', email: '  lectora@EXAMPLE.com ' }, { grants, secret });

    expect(result.grantId).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects a valid code used with another email with the same error as an unknown code', async () => {
    const grants = storeWithGrant();

    const otherEmail = await deniedError(validateAccess({ code, email: 'otra@example.com' }, { grants, secret }));
    const unknownCode = await deniedError(validateAccess({ code: 'AAAA-BBBB-CCCC', email }, { grants, secret }));

    expect(otherEmail).toBe(unknownCode);
  });

  it('rejects a revoked code used with its email', async () => {
    const grants = storeWithGrant({ revoked: true });

    await deniedError(validateAccess({ code, email }, { grants, secret }));
  });

  it('rejects a grant whose revoked flag is missing', async () => {
    const grants = storeWithGrant({ revoked: undefined });

    await deniedError(validateAccess({ code, email }, { grants, secret }));
  });

  it.each([
    { code: 42, email },
    { code, email: null },
    { code, email: 'not-an-email' },
    { code, email: '@example.com' },
    { code, email: 'lectora@@example.com' },
    { code, email: 'lectora@example.' },
    { code, email: 'lectora@.com' },
    { code, email: 'lec tora@example.com' },
    { code: 'SHORT', email },
  ])('rejects malformed input %o', async (input) => {
    await deniedError(validateAccess(input, { grants: storeWithGrant(), secret }));
  });

  it('fails loudly when the secret is too short', async () => {
    await expect(validateAccess({ code, email }, { grants: storeWithGrant(), secret: 'short' })).rejects.toThrow(/secret/);
  });
});

describe('createGrantRecord', () => {
  it('never keeps the code in clear', () => {
    const { id, record } = createGrantRecord({ code, email }, { secret, now: new Date('2026-11-19T00:00:00Z') });
    const stored = JSON.stringify({ id, record }).toLowerCase();

    expect(stored).not.toContain('k7qm');
    expect(stored).not.toContain('2xpa');
  });

  it('keeps the email the code was given to, as it is checked on entry, so the admin knows who has it', () => {
    const { record } = createGrantRecord({ code, email: '  Lectora@Example.com ' }, { secret, now: new Date('2026-11-19T00:00:00Z') });

    expect(record).toEqual({
      email: 'lectora@example.com',
      emailFingerprint: expect.stringMatching(/^[0-9a-f]{64}$/),
      revoked: false,
      createdAt: new Date('2026-11-19T00:00:00Z'),
    });
  });
});
