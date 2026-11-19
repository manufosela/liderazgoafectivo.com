import { describe, expect, it } from 'vitest';
import {
  KEY_URI_PLACEHOLDER,
  assertDuration,
  buildCatalog,
  chapterId,
  deriveChapterKey,
  hlsArguments,
  keyInfoFile,
  playlistDuration,
} from './packaging.js';

const mediaKey = 'media-key-with-at-least-32-characters';

describe('chapterId and deriveChapterKey', () => {
  it('names chapters with three digits and refuses anything else', () => {
    expect(chapterId(0)).toBe('000');
    expect(chapterId(93)).toBe('093');
    expect(() => chapterId(-1)).toThrow(/chapter/);
    expect(() => chapterId(1.5)).toThrow(/chapter/);
  });

  it('derives a stable 16-byte key per chapter, different for every chapter and master key', () => {
    const key = deriveChapterKey(mediaKey, '001');

    expect(key).toHaveLength(16);
    expect(deriveChapterKey(mediaKey, '001').equals(key)).toBe(true);
    expect(deriveChapterKey(mediaKey, '002').equals(key)).toBe(false);
    expect(deriveChapterKey('other-media-key-with-at-least-32-chars', '001').equals(key)).toBe(false);
    expect(() => deriveChapterKey('short', '001')).toThrow(/media key/);
  });
});

describe('ffmpeg settings', () => {
  it('writes the placeholder key URI and the local key path', () => {
    expect(keyInfoFile('/tmp/keys/001.key')).toBe(`${KEY_URI_PLACEHOLDER}\n/tmp/keys/001.key\n`);
  });

  it('encodes encrypted HLS in AAC mono with the shared gain and limiter', () => {
    const args = hlsArguments({ input: '/in/001.mp3', outputDir: '/out/001', keyInfoPath: '/tmp/keys/001.keyinfo', gainDb: 4.3 });

    expect(args).toEqual(expect.arrayContaining(['-hls_key_info_file', '/tmp/keys/001.keyinfo', '-hls_playlist_type', 'vod', '-ac', '1', '-b:a', '96k']));
    expect(args[args.indexOf('-af') + 1]).toBe('volume=4.30dB,alimiter=limit=0.7:level=false:attack=5:release=50');
    expect(args.at(-1)).toBe('/out/001/index.m3u8');
  });
});

describe('durations and catalog', () => {
  const playlist = ['#EXTM3U', '#EXT-X-KEY:METHOD=AES-128,URI="chapter.key"', '#EXTINF:10.000000,', 'seg-0000.ts', '#EXTINF:4.250000,', 'seg-0001.ts', '#EXT-X-ENDLIST'].join('\n');

  it('adds up the segment durations of a playlist', () => {
    expect(playlistDuration(playlist)).toBeCloseTo(14.25);
  });

  it('accepts a packaged chapter within half a second of its source and refuses a larger gap', () => {
    expect(() => assertDuration({ id: '001', packaged: 14.25, source: 14.6 })).not.toThrow();
    expect(() => assertDuration({ id: '001', packaged: 14.25, source: 15 })).toThrow(/001/);
  });

  it('lists every chapter with its title and rounded duration', () => {
    expect(buildCatalog([{ id: '000', title: 'Apertura', duration: 14.248 }])).toEqual({ chapters: [{ id: '000', title: 'Apertura', duration: 14.2 }] });
  });
});
