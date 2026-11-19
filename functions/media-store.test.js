import { describe, expect, it, vi } from 'vitest';

// Keep the Admin SDK out of unit tests: its optional Firestore client is not installed on every runtime.
vi.mock('./database.js', () => ({ getAudiobookApp: () => ({}) }));
vi.mock('firebase-admin/storage', () => ({ getStorage: () => ({ bucket: (name) => ({ name }) }) }));

const { AUDIOBOOK_BUCKET, createBucketMediaStore, getAudiobookBucket } = await import('./media-store.js');

const createFakeBucket = (objects, failure) => ({
  file: (name) => ({
    download: async () => {
      if (failure) throw failure;
      if (!objects.has(name)) throw Object.assign(new Error('No such object'), { code: 404 });
      return [objects.get(name)];
    },
  }),
});

describe('createBucketMediaStore', () => {
  it('reads an object and answers null for a missing one', async () => {
    const media = createBucketMediaStore(createFakeBucket(new Map([['catalog.json', Buffer.from('{}')]])));

    expect((await media.read('catalog.json')).toString()).toBe('{}');
    expect(await media.read('chapters/999/index.m3u8')).toBeNull();
  });

  it('opens the private audiobook bucket', () => {
    expect(getAudiobookBucket()).toEqual({ name: AUDIOBOOK_BUCKET });
  });

  it('lets any other storage failure surface', async () => {
    const media = createBucketMediaStore(createFakeBucket(new Map(), Object.assign(new Error('permission denied'), { code: 403 })));

    await expect(media.read('catalog.json')).rejects.toThrow('permission denied');
  });
});
