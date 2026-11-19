import { describe, expect, it } from 'vitest';
import { createFirestoreAttemptStore } from './attempt-store.js';

// Stand-in for the Admin SDK transaction API; dates come back as Timestamp-like values.
const createFakeDb = () => {
  const documents = new Map();
  const snapshot = (path) => {
    const data = documents.get(path);
    return { exists: data !== undefined, data: () => data && { ...data, windowStart: { toDate: () => data.windowStart } } };
  };
  return {
    collection: () => ({ doc: (id) => ({ path: `attempts/${id}` }) }),
    runTransaction: async (work) => {
      const writes = [];
      await work({ getAll: async (...refs) => refs.map(({ path }) => snapshot(path)), set: (ref, data) => writes.push([ref.path, data]) });
      writes.forEach(([path, data]) => documents.set(path, data));
    },
  };
};

describe('createFirestoreAttemptStore', () => {
  it('reads and writes every key in one transaction, and writes nothing if the change throws', async () => {
    const store = createFirestoreAttemptStore(createFakeDb());
    const windowStart = new Date('2026-11-19T10:00:00Z');
    const seen = [];

    await store.transact(['client', 'code'], (records) => records.map((record) => ({ count: (record?.count ?? 0) + 1, windowStart })));
    await expect(
      store.transact(['client', 'code'], () => {
        throw new Error('blocked');
      }),
    ).rejects.toThrow('blocked');
    await store.transact(['client', 'code'], (records) => {
      seen.push(...records);
      return records;
    });

    expect(seen).toEqual([
      { count: 1, windowStart },
      { count: 1, windowStart },
    ]);
  });
});
