import { describe, expect, it } from 'vitest';
import { AccessDeniedError, validateAccess } from './access.js';
import { GrantInputError, GrantNotFoundError, createGrant, generateCode, listGrants, revokeGrant } from './grants-admin.js';

const secret = 'test-secret-with-at-least-32-characters';
const now = new Date('2026-11-19T10:00:00Z');
const email = 'lectora@example.com';

const createMemoryStore = (entries = []) => {
  const grants = new Map(entries);
  return {
    grants,
    get: async (id) => grants.get(id) ?? null,
    create: async (id, record) => {
      if (grants.has(id)) throw new Error('already exists');
      grants.set(id, record);
    },
    list: async () => [...grants].map(([id, record]) => ({ id, ...record })),
    revoke: async (id, revokedAt) => grants.set(id, { ...grants.get(id), revoked: true, revokedAt }),
  };
};

describe('generateCode', () => {
  it('builds 12 characters of the Crockford alphabet in groups of four', () => {
    const indexes = [0, 9, 10, 17, 18, 31, 1, 2, 3, 4, 5, 6];
    const pick = () => indexes.shift();

    expect(generateCode(pick)).toBe('09AH-JZ12-3456');
    expect(generateCode()).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
  });
});

describe('createGrant', () => {
  it('returns the code once and stores only fingerprints with the note', async () => {
    const store = createMemoryStore();

    const { code, shortId } = await createGrant({ email, note: '  Regalo de Navidad ' }, { grants: store, secret, now });

    await expect(validateAccess({ code, email }, { grants: store, secret })).resolves.toBeDefined();
    const stored = JSON.stringify([...store.grants]);
    expect(stored).not.toContain(code.replaceAll('-', ''));
    expect(stored).not.toContain('lectora');
    expect([...store.grants.values()][0]).toMatchObject({ note: 'Regalo de Navidad', revoked: false, createdAt: now });
    expect(shortId).toMatch(/^[0-9a-f]{8}$/);
  });

  it.each([
    [{ email: 'not-an-email', note: 'Nota' }, /email/],
    [{ email, note: '   ' }, /note/],
    [{ email, note: 'x'.repeat(81) }, /note/],
    [{ email, note: 42 }, /note/],
  ])('rejects %o with a clear message', async (input, message) => {
    const attempt = createGrant(input, { grants: createMemoryStore(), secret, now });

    await expect(attempt).rejects.toThrow(message);
    await expect(attempt).rejects.toBeInstanceOf(GrantInputError);
  });

  it('reports a misconfigured key as such, not as a bad email', async () => {
    const attempt = createGrant({ email, note: 'Nota' }, { grants: createMemoryStore(), secret: 'short', now });

    await expect(attempt).rejects.toThrow(/secret/);
    await expect(attempt).rejects.not.toBeInstanceOf(GrantInputError);
  });
});

describe('listGrants and revokeGrant', () => {
  it('lists note, date and state without the code, and a revoked code stops working', async () => {
    const store = createMemoryStore();
    const { code, shortId } = await createGrant({ email, note: 'Equipo' }, { grants: store, secret, now });

    await revokeGrant(shortId, { grants: store, now });

    const listed = await listGrants({ grants: store });
    expect(listed).toEqual([{ shortId, note: 'Equipo', createdAt: now, status: 'revoked' }]);
    expect(JSON.stringify(listed)).not.toContain(code.replaceAll('-', ''));
    await expect(validateAccess({ code, email }, { grants: store, secret })).rejects.toBeInstanceOf(AccessDeniedError);
  });

  it('lists active grants oldest first', async () => {
    const later = { emailFingerprint: 'b', note: 'Segundo', revoked: false, createdAt: new Date('2026-11-20T00:00:00Z') };
    const earlier = { emailFingerprint: 'a', note: 'Primero', revoked: false, createdAt: now };
    const store = createMemoryStore([['bbbbbbbb11', later], ['aaaaaaaa11', earlier]]);

    expect((await listGrants({ grants: store })).map(({ note, status }) => [note, status])).toEqual([['Primero', 'active'], ['Segundo', 'active']]);
  });

  it.each([
    ['cccccccc', /No grant/, GrantNotFoundError],
    ['abcd1234', /More than one grant/, GrantInputError],
    ['ABC', /short id/, GrantInputError],
  ])('refuses to revoke %s', async (shortId, message, type) => {
    const record = { emailFingerprint: 'x', note: 'n', revoked: false, createdAt: now };
    const store = createMemoryStore([['abcd1234aa', record], ['abcd1234bb', record]]);
    const attempt = revokeGrant(shortId, { grants: store, now });

    await expect(attempt).rejects.toThrow(message);
    await expect(attempt).rejects.toBeInstanceOf(type);
  });
});
