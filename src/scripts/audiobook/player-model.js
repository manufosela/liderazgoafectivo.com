/** Cloud Function that serves the catalog, playlists, keys and segments to a valid session. */
export const AUDIO_BASE_URL = 'https://europe-west1-comunidad-liderazgoafectivo.cloudfunctions.net/audio';
const PROGRESS_KEY = 'audiobook-progress';
const RATE_KEY = 'audiobook-rate';

/** Speeds offered to the listener: the voice reads fast, so two of them are slower than normal. */
export const PLAYBACK_RATES = [0.8, 0.9, 1, 1.25];
const CHAPTER_ID = /^\d{3}$/;

/** URL of an audio service resource for this session; native Safari HLS needs the session in the URL. */
export const mediaUrl = (path, token, base = AUDIO_BASE_URL) => `${base}${path}?session=${encodeURIComponent(token)}`;

/**
 * @returns {Promise<{ok: true, chapters: Array<{id: string, title: string, duration: number}>} | {ok: false, reason: 'expired' | 'unavailable' | 'network'}>}
 */
export const fetchCatalog = async (token, { fetch: send = globalThis.fetch, base = AUDIO_BASE_URL } = {}) => {
  let response;
  try {
    response = await send(mediaUrl('/catalog', token, base));
  } catch {
    return { ok: false, reason: 'network' };
  }
  if (response.status === 401) return { ok: false, reason: 'expired' };
  const body = response.status === 200 ? await response.json().catch(() => null) : null;
  if (!Array.isArray(body?.chapters)) return { ok: false, reason: 'unavailable' };
  return { ok: true, chapters: body.chapters };
};

export const nextChapterId = (chapters, id) => {
  const index = chapters.findIndex((chapter) => chapter.id === id);
  return index === -1 ? null : (chapters[index + 1]?.id ?? null);
};

export const formatDuration = (seconds) => {
  const total = Math.round(seconds);
  const [hours, minutes, rest] = [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60];
  const twoDigits = (value) => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${twoDigits(minutes)}:${twoDigits(rest)}` : `${minutes}:${twoDigits(rest)}`;
};

/**
 * Remembers where the listener stopped (chapter and whole second only) on this device.
 * Storage may be blocked; then nothing is remembered and save() returns false.
 * @param {Storage} storage
 */
export const createProgressStore = (storage) => ({
  save: ({ chapterId, position }) => {
    try {
      storage.setItem(PROGRESS_KEY, JSON.stringify({ chapterId, position: Math.floor(position) }));
      return true;
    } catch {
      return false;
    }
  },
  load: () => {
    try {
      const { chapterId, position } = JSON.parse(storage.getItem(PROGRESS_KEY));
      return CHAPTER_ID.test(chapterId) && Number.isInteger(position) && position >= 0 ? { chapterId, position } : null;
    } catch {
      return null;
    }
  },
});

/**
 * Remembers the listening speed on this device; anything but an offered speed means normal speed.
 * @param {Storage} storage
 */
export const createRateStore = (storage) => ({
  save: (rate) => {
    try {
      storage.setItem(RATE_KEY, String(rate));
      return true;
    } catch {
      return false;
    }
  },
  load: () => {
    try {
      const rate = Number(storage.getItem(RATE_KEY));
      return PLAYBACK_RATES.includes(rate) ? rate : 1;
    } catch {
      return 1;
    }
  },
});
