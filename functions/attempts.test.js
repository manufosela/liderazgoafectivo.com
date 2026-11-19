import { describe, expect, it } from 'vitest';
import { ATTEMPT_WINDOW_MS, TooManyAttemptsError, attemptKeys, createAttemptLimiter } from './attempts.js';

const secret = 'test-secret-with-at-least-32-characters';
const start = new Date('2026-11-19T10:00:00Z');
const at = (milliseconds) => new Date(start.getTime() + milliseconds);

// Serialises transactions like Firestore does for the same documents.
const createMemoryStore = () => {
  const records = new Map();
  let queue = Promise.resolve();
  return {
    records,
    transact: (keys, change) => {
      const run = queue.then(() => {
        const updated = change(keys.map((key) => records.get(key) ?? null));
        keys.forEach((key, index) => records.set(key, updated[index]));
      });
      queue = run.catch(() => {});
      return run;
    },
  };
};

const reserveTimes = async (limiter, keys, times, now) => {
  for (let attempt = 0; attempt < times; attempt += 1) await limiter.reserve(keys, now);
};

describe('attemptKeys', () => {
  it('fingerprints the client and the code without keeping them in clear', () => {
    const keys = attemptKeys({ ip: '203.0.113.7', code: ' k7qm-2xpa-9rtd ' }, secret);

    expect(keys).toEqual(attemptKeys({ ip: '203.0.113.7', code: 'K7QM2XPA9RTD' }, secret));
    expect(keys).toHaveLength(2);
    expect(keys.join()).not.toMatch(/203|k7qm|K7QM/);
  });
});

describe('createAttemptLimiter', () => {
  it('allows five failed attempts and refuses the sixth within fifteen minutes', async () => {
    const limiter = createAttemptLimiter(createMemoryStore());
    const keys = ['client', 'code'];

    await reserveTimes(limiter, keys, 5, start);

    await expect(limiter.reserve(keys, at(1000))).rejects.toBeInstanceOf(TooManyAttemptsError);
  });

  it('never lets more than five concurrent attempts through', async () => {
    const limiter = createAttemptLimiter(createMemoryStore());

    const results = await Promise.allSettled(Array.from({ length: 8 }, () => limiter.reserve(['client', 'code'], start)));

    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(5);
  });

  it('does not count an attempt that turned out to be valid', async () => {
    const store = createMemoryStore();
    const limiter = createAttemptLimiter(store);

    await reserveTimes(limiter, ['client'], 5, start);
    await limiter.release(['client'], start);

    await expect(limiter.reserve(['client'], start)).resolves.toBeUndefined();
    expect(store.records.get('client').count).toBe(5);
  });

  it('blocks when either the client or the code reached the limit', async () => {
    const limiter = createAttemptLimiter(createMemoryStore());

    await reserveTimes(limiter, ['client-a', 'shared-code'], 5, start);

    await expect(limiter.reserve(['client-b', 'shared-code'], start)).rejects.toBeInstanceOf(TooManyAttemptsError);
    await expect(limiter.reserve(['client-a', 'other-code'], start)).rejects.toBeInstanceOf(TooManyAttemptsError);
    await expect(limiter.reserve(['client-b', 'other-code'], start)).resolves.toBeUndefined();
  });

  it('opens a new window once fifteen minutes have passed', async () => {
    const store = createMemoryStore();
    const limiter = createAttemptLimiter(store);
    await reserveTimes(limiter, ['client'], 5, start);

    await limiter.reserve(['client'], at(ATTEMPT_WINDOW_MS));
    await limiter.release(['unknown'], start);

    expect(store.records.get('client')).toEqual({ count: 1, windowStart: at(ATTEMPT_WINDOW_MS) });
    expect(store.records.get('unknown')).toEqual({ count: 0, windowStart: start });
  });
});
