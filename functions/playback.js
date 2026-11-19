import { KEY_URI_PLACEHOLDER } from './packaging.js';

const SEGMENT_FILE = /^seg-\d{4}\.ts$/;

// Fixed patterns only: anything else (dots, encoded slashes, other names) never reaches the bucket.
const ROUTES = [
  [/^\/catalog$/, () => ({ kind: 'catalog', object: 'catalog.json' })],
  [/^\/chapters\/(\d{3})\/index\.m3u8$/, ([, id]) => ({ kind: 'playlist', id, object: `chapters/${id}/index.m3u8` })],
  [/^\/chapters\/(\d{3})\/key$/, ([, id]) => ({ kind: 'key', id })],
  [/^\/chapters\/(\d{3})\/(seg-\d{4}\.ts)$/, ([, id, file]) => ({ kind: 'segment', id, object: `chapters/${id}/${file}` })],
];

/**
 * Maps a request path to the audio resource it asks for, or null when it matches no known resource.
 * @returns {{kind: 'catalog' | 'playlist' | 'key' | 'segment', id?: string, object?: string} | null}
 */
export const parseMediaPath = (path) => {
  for (const [pattern, build] of ROUTES) {
    const match = pattern.exec(path);
    if (match) return build(match);
  }
  return null;
};

/**
 * Points the key and every segment of a chapter playlist at this service with the listener's session,
 * as relative URIs so they resolve next to the playlist.
 */
export const rewritePlaylist = (playlist, token) => {
  const session = `session=${encodeURIComponent(token)}`;
  return playlist
    .split('\n')
    .map((line) => {
      if (line.startsWith('#EXT-X-KEY:')) return line.replace(`URI="${KEY_URI_PLACEHOLDER}"`, `URI="key?${session}"`);
      if (line === '' || line.startsWith('#')) return line;
      if (SEGMENT_FILE.test(line)) return `${line}?${session}`;
      throw new Error(`Unexpected playlist line: ${line}`);
    })
    .join('\n');
};
