import { createHmac } from 'node:crypto';
import { join } from 'node:path';

export const SEGMENT_SECONDS = 10;
export const DURATION_TOLERANCE_SECONDS = 0.5;
/** Key URI written into every playlist; the playback service replaces it with the session's key URL. */
export const KEY_URI_PLACEHOLDER = 'chapter.key';
const MEDIA_KEY_MIN_LENGTH = 32;
const CHAPTER_KEY_BYTES = 16;
// Same loudness chain as the M4B edition, so both sound alike.
const PEAK_LIMIT = 0.7;

/** Three-digit chapter id used in object paths and key derivation. */
export const chapterId = (number) => {
  if (!Number.isInteger(number) || number < 0 || number > 999) throw new Error(`Invalid chapter number ${number}`);
  return String(number).padStart(3, '0');
};

/**
 * AES-128 key of one chapter, derived from the master media key so nothing per chapter is stored.
 * @returns {Buffer} 16 bytes
 */
export const deriveChapterKey = (mediaKey, id) => {
  if (typeof mediaKey !== 'string' || mediaKey.length < MEDIA_KEY_MIN_LENGTH) {
    throw new Error(`The media key must have at least ${MEDIA_KEY_MIN_LENGTH} characters`);
  }
  return createHmac('sha256', mediaKey).update(`chapter:${id}`).digest().subarray(0, CHAPTER_KEY_BYTES);
};

/** ffmpeg key info file: key URI for the playlist, then the local key file path. */
export const keyInfoFile = (keyPath) => `${KEY_URI_PLACEHOLDER}\n${keyPath}\n`;

export const hlsArguments = ({ input, outputDir, keyInfoPath, gainDb }) => [
  '-y', '-v', 'error', '-i', input, '-vn',
  '-af', `volume=${gainDb.toFixed(2)}dB,alimiter=limit=${PEAK_LIMIT}:level=false:attack=5:release=50`,
  '-c:a', 'aac', '-b:a', '96k', '-ac', '1', '-ar', '44100',
  '-f', 'hls', '-hls_time', String(SEGMENT_SECONDS), '-hls_playlist_type', 'vod', '-hls_segment_type', 'mpegts',
  '-hls_key_info_file', keyInfoPath,
  '-hls_segment_filename', join(outputDir, 'seg-%04d.ts'),
  join(outputDir, 'index.m3u8'),
];

/** Total duration in seconds of an HLS playlist, from its #EXTINF lines. */
export const playlistDuration = (playlist) =>
  [...playlist.matchAll(/^#EXTINF:([\d.]+),/gm)].reduce((total, [, seconds]) => total + Number(seconds), 0);

export const assertDuration = ({ id, packaged, source }) => {
  if (Math.abs(packaged - source) > DURATION_TOLERANCE_SECONDS) {
    throw new Error(`Chapter ${id} lasts ${packaged.toFixed(2)} s packaged and ${source.toFixed(2)} s in the source`);
  }
};

export const buildCatalog = (chapters) => ({
  chapters: chapters.map(({ id, title, duration }) => ({ id, title, duration: Math.round(duration * 10) / 10 })),
});
