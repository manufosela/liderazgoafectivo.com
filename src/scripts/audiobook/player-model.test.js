import { describe, expect, it } from 'vitest';
import { PLAYBACK_RATES, createProgressStore, createRateStore, fetchCatalog, formatDuration, mediaUrl, nextChapterId } from './player-model.js';

const chapters = [
  { id: '000', title: 'Apertura', duration: 16.9 },
  { id: '001', title: 'Prólogo', duration: 240.2 },
];

const createStorage = () => {
  const items = new Map();
  return { items, getItem: (key) => items.get(key) ?? null, setItem: (key, value) => items.set(key, value) };
};

describe('mediaUrl', () => {
  it('adds the encoded session to an audio service path', () => {
    expect(mediaUrl('/chapters/001/index.m3u8', 'a.b', 'https://api.example/audio')).toBe('https://api.example/audio/chapters/001/index.m3u8?session=a.b');
    expect(mediaUrl('/catalog', 'a"b', 'https://api.example/audio')).toBe('https://api.example/audio/catalog?session=a%22b');
  });
});

describe('fetchCatalog', () => {
  const respond = (status, body) => async () => ({ status, json: async () => body });

  it('returns the chapters for a valid session', async () => {
    expect(await fetchCatalog('a.b', { fetch: respond(200, { chapters }) })).toEqual({ ok: true, chapters });
  });

  it.each([
    [401, { error: 'invalid_session' }, 'expired'],
    [500, {}, 'unavailable'],
    [200, { chapters: 'nope' }, 'unavailable'],
  ])('maps status %i to %s', async (status, body, reason) => {
    expect(await fetchCatalog('a.b', { fetch: respond(status, body) })).toEqual({ ok: false, reason });
  });

  it('reports a network failure', async () => {
    expect(await fetchCatalog('a.b', { fetch: async () => Promise.reject(new TypeError('offline')) })).toEqual({ ok: false, reason: 'network' });
  });
});

describe('nextChapterId and formatDuration', () => {
  it('finds the following chapter and stops after the last one', () => {
    expect(nextChapterId(chapters, '000')).toBe('001');
    expect(nextChapterId(chapters, '001')).toBeNull();
    expect(nextChapterId(chapters, '999')).toBeNull();
  });

  it.each([
    [16.9, '0:17'],
    [240.2, '4:00'],
    [3725, '1:02:05'],
  ])('formats %f seconds as %s', (seconds, text) => {
    expect(formatDuration(seconds)).toBe(text);
  });
});

describe('createProgressStore', () => {
  it('remembers the chapter and second, never anything else', () => {
    const storage = createStorage();
    const store = createProgressStore(storage);

    store.save({ chapterId: '001', position: 93.4, token: 'must-not-be-kept' });

    expect(store.load()).toEqual({ chapterId: '001', position: 93 });
    expect([...storage.items.values()].join()).not.toContain('must-not-be-kept');
  });

  it.each([['{broken'], ['{"chapterId":"x","position":1}'], ['{"chapterId":"001","position":-5}']])('ignores the stored value %s', (value) => {
    const storage = createStorage();
    storage.setItem('audiobook-progress', value);

    expect(createProgressStore(storage).load()).toBeNull();
  });

  it('works without storage when the browser blocks it', () => {
    const blocked = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('SecurityError');
      },
    };

    expect(createProgressStore(blocked).save({ chapterId: '001', position: 1 })).toBe(false);
    expect(createProgressStore(blocked).load()).toBeNull();
  });
});

describe('createRateStore', () => {
  it('offers two slower speeds, the normal one and a faster one', () => {
    expect(PLAYBACK_RATES).toEqual([0.8, 0.9, 1, 1.25]);
  });

  it('remembers one of the offered speeds', () => {
    const store = createRateStore(createStorage());

    expect(store.save(0.9)).toBe(true);
    expect(store.load()).toBe(0.9);
  });

  it.each([[null], ['3'], ['rápido']])('starts at normal speed when the stored value is %o', (value) => {
    const storage = createStorage();
    if (value !== null) storage.setItem('audiobook-rate', value);

    expect(createRateStore(storage).load()).toBe(1);
  });

  it('works at normal speed when the browser blocks storage', () => {
    const refuse = () => {
      throw new Error('SecurityError');
    };
    const blocked = { getItem: refuse, setItem: refuse };

    expect(createRateStore(blocked).save(0.8)).toBe(false);
    expect(createRateStore(blocked).load()).toBe(1);
  });
});
