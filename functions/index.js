import { defineSecret } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';
import { createFirestoreAttemptStore } from './attempt-store.js';
import { createAttemptLimiter } from './attempts.js';
import { getAudiobookDatabase } from './database.js';
import { createFirestoreGrantStore } from './grant-store.js';
import { createBucketMediaStore, getAudiobookBucket } from './media-store.js';
import { createPlaybackHandler } from './playback-handler.js';
import { createStartSessionHandler } from './start-session.js';

const fingerprintKey = defineSecret('AUDIOBOOK_FINGERPRINT_KEY');
const sessionKey = defineSecret('AUDIOBOOK_SESSION_KEY');
const mediaKey = defineSecret('AUDIOBOOK_MEDIA_KEY');

// Handlers are built on the first request, so loading this module during deploy never opens the database.
let startSessionHandler;
let playbackHandler;

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

export const audio = onRequest(
  { region: 'europe-west1', invoker: 'public', maxInstances: 5, secrets: [sessionKey, mediaKey] },
  (request, response) => {
    playbackHandler ??= createPlaybackHandler({
      grants: createFirestoreGrantStore(getAudiobookDatabase()),
      media: createBucketMediaStore(getAudiobookBucket()),
      sessionKey: () => sessionKey.value(),
      mediaKey: () => mediaKey.value(),
      now: () => new Date(),
    });
    return playbackHandler(request, response);
  },
);
