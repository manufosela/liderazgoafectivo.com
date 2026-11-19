import { getStorage } from 'firebase-admin/storage';
import { getAudiobookApp } from './database.js';

/** Private bucket with the encrypted chapters; public access prevention is enforced on it. */
export const AUDIOBOOK_BUCKET = 'comunidad-liderazgoafectivo-audiolibro';

export const getAudiobookBucket = () => getStorage(getAudiobookApp()).bucket(AUDIOBOOK_BUCKET);

/**
 * Reads audio objects from the bucket: their bytes, or null when the object does not exist.
 * @param {import('@google-cloud/storage').Bucket} bucket
 */
export const createBucketMediaStore = (bucket) => ({
  read: async (object) => {
    try {
      const [contents] = await bucket.file(object).download();
      return contents;
    } catch (error) {
      if (error.code === 404) return null;
      throw error;
    }
  },
});
