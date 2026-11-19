import { describe, expect, it } from 'vitest';
import { AccessDeniedError, createGrantRecord, validateAccess } from './access.js';
import { createFirestoreGrantStore } from './grant-store.js';

const secret = 'test-secret-with-at-least-32-characters';
const access = { code: 'K7QM-2XPA-9RTD', email: 'lectora@example.com' };

const createFakeDb = (documents) => ({
  collection: (name) => ({
    doc: (id) => ({
      get: async () => {
        const data = documents.get(`${name}/${id}`);
        return { exists: data !== undefined, data: () => data };
      },
    }),
  }),
});

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
});
