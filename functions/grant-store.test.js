import { describe, expect, it } from 'vitest';
import { AccessDeniedError, createGrantRecord, validateAccess } from './access.js';
import { createFirestoreGrantStore } from './grant-store.js';

const secret = 'test-secret-with-at-least-32-characters';
const access = { code: 'K7QM-2XPA-9RTD', email: 'lectora@example.com' };

// Minimal stand-in for the Admin SDK: documents keyed "collection/id", dates stored as Timestamp-like values.
const createFakeDb = (documents) => ({
  collection: (name) => ({
    get: async () => ({
      docs: [...documents]
        .filter(([key]) => key.startsWith(`${name}/`))
        .map(([key, data]) => ({ id: key.slice(name.length + 1), data: () => data })),
    }),
    doc: (id) => ({
      get: async () => {
        const data = documents.get(`${name}/${id}`);
        return { exists: data !== undefined, data: () => data };
      },
      create: async (record) => {
        if (documents.has(`${name}/${id}`)) throw new Error('ALREADY_EXISTS');
        documents.set(`${name}/${id}`, record);
      },
      update: async (changes) => documents.set(`${name}/${id}`, { ...documents.get(`${name}/${id}`), ...changes }),
    }),
  }),
});

const timestamp = (date) => ({ toDate: () => date });

describe('createFirestoreGrantStore', () => {
  it('lets validateAccess accept a grant stored in the grants collection', async () => {
    const { id, record } = createGrantRecord(access, { secret, now: new Date('2026-11-19T00:00:00Z') });
    const grants = createFirestoreGrantStore(createFakeDb(new Map([[`grants/${id}`, record]])));

    await expect(validateAccess(access, { grants, secret })).resolves.toEqual({ grantId: id });
  });

  it('returns null for a missing grant, so the access is denied', async () => {
    const grants = createFirestoreGrantStore(createFakeDb(new Map()));

    expect(await grants.get('missing')).toBeNull();
    await expect(validateAccess(access, { grants, secret })).rejects.toBeInstanceOf(AccessDeniedError);
  });

  it('creates without overwriting, lists with dates and revokes', async () => {
    const documents = new Map();
    const grants = createFirestoreGrantStore(createFakeDb(documents));
    const createdAt = new Date('2026-11-19T00:00:00Z');
    const revokedAt = new Date('2026-11-20T00:00:00Z');

    await grants.create('abc', { emailFingerprint: 'e', revoked: false, createdAt });
    await expect(grants.create('abc', { emailFingerprint: 'other' })).rejects.toThrow('ALREADY_EXISTS');
    documents.set('grants/abc', { ...documents.get('grants/abc'), createdAt: timestamp(createdAt) });
    await grants.revoke('abc', revokedAt);

    expect(await grants.list()).toEqual([{ id: 'abc', emailFingerprint: 'e', revoked: true, revokedAt, createdAt }]);
  });
});
