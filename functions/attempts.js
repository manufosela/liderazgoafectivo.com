import { createHmac } from 'node:crypto';

export const MAX_FAILED_ATTEMPTS = 5;
export const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

export class TooManyAttemptsError extends Error {
  constructor() {
    super('Too many attempts, try again later');
    this.name = 'TooManyAttemptsError';
  }
}

const fingerprint = (secret, value) => createHmac('sha256', secret).update(value).digest('hex');

/** Limiter keys for the client and for the code tried, both fingerprinted so neither is stored in clear. */
export const attemptKeys = ({ ip, code }, secret) => [
  fingerprint(secret, `ip:${ip}`),
  fingerprint(secret, `code:${String(code).replaceAll(/[\s-]/g, '').toUpperCase()}`),
];

const inWindow = (record, now) => record !== null && now - record.windowStart < ATTEMPT_WINDOW_MS;

const counted = (record, now) => (inWindow(record, now) ? record : { count: 0, windowStart: now });

/**
 * Allows at most MAX_FAILED_ATTEMPTS failed attempts per client and per code within ATTEMPT_WINDOW_MS.
 * reserve() counts the attempt atomically before validating; release() gives it back when it was valid.
 * @param {{transact: (keys: string[], change: (records: Array<object | null>) => object[]) => Promise<void>}} store
 */
export const createAttemptLimiter = (store) => ({
  reserve: (keys, now) =>
    store.transact(keys, (records) => {
      const current = records.map((record) => counted(record, now));
      if (current.some(({ count }) => count >= MAX_FAILED_ATTEMPTS)) throw new TooManyAttemptsError();
      return current.map(({ count, windowStart }) => ({ count: count + 1, windowStart }));
    }),
  release: (keys, now) =>
    store.transact(keys, (records) =>
      records.map((record) => {
        const { count, windowStart } = counted(record, now);
        return { count: Math.max(0, count - 1), windowStart };
      }),
    ),
});
