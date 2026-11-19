import { defineSecret } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';
import { createFirestoreAttemptStore } from './attempt-store.js';
import { createAttemptLimiter } from './attempts.js';
import { getAudiobookDatabase } from './database.js';
import { createFirestoreGrantStore } from './grant-store.js';
import { createStartSessionHandler } from './start-session.js';

const fingerprintKey = defineSecret('AUDIOBOOK_FINGERPRINT_KEY');
const sessionKey = defineSecret('AUDIOBOOK_SESSION_KEY');

// Built on the first request, so loading this module during deploy never opens the database.
let startSessionHandler;

export const startSession = onRequest(
  { region: 'europe-west1', invoker: 'public', maxInstances: 3, secrets: [fingerprintKey, sessionKey] },
  (request, response) => {
    startSessionHandler ??= (() => {
      const db = getAudiobookDatabase();
      return createStartSessionHandler({
        grants: createFirestoreGrantStore(db),
        limiter: createAttemptLimiter(createFirestoreAttemptStore(db)),
        fingerprintKey: () => fingerprintKey.value(),
        sessionKey: () => sessionKey.value(),
        now: () => new Date(),
      });
    })();
    return startSessionHandler(request, response);
  },
);
