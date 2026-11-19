import { describe, expect, it } from 'vitest';
import { parseMediaPath, rewritePlaylist } from './playback.js';

describe('parseMediaPath', () => {
  it.each([
    ['/catalog', { kind: 'catalog', object: 'catalog.json' }],
    ['/chapters/001/index.m3u8', { kind: 'playlist', id: '001', object: 'chapters/001/index.m3u8' }],
    ['/chapters/093/key', { kind: 'key', id: '093' }],
    ['/chapters/000/seg-0007.ts', { kind: 'segment', id: '000', object: 'chapters/000/seg-0007.ts' }],
  ])('maps %s to its bucket object', (path, route) => {
    expect(parseMediaPath(path)).toEqual(route);
  });

  it.each([
    ['/chapters/../catalog.json'],
    ['/chapters/001/..%2F002/seg-0000.ts'],
    ['/chapters/1/index.m3u8'],
    ['/chapters/001/seg-1.ts'],
    ['/chapters/001/seg-0000.ts/extra'],
    ['/chapters/001/other.m3u8'],
    ['/catalog.json'],
    ['/'],
    [''],
  ])('refuses %s', (path) => {
    expect(parseMediaPath(path)).toBeNull();
  });
});

describe('rewritePlaylist', () => {
  const playlist = [
    '#EXTM3U',
    '#EXT-X-KEY:METHOD=AES-128,URI="chapter.key",IV=0x00000000000000000000000000000000',
    '#EXTINF:10.007800,',
    'seg-0000.ts',
    '#EXTINF:6.873778,',
    'seg-0001.ts',
    '#EXT-X-ENDLIST',
    '',
  ].join('\n');

  it('adds the session to the key and to every segment', () => {
    const rewritten = rewritePlaylist(playlist, 'abc.def');

    expect(rewritten).toContain('URI="key?session=abc.def"');
    expect(rewritten).toContain('\nseg-0000.ts?session=abc.def\n');
    expect(rewritten).toContain('\nseg-0001.ts?session=abc.def\n');
    expect(rewritten).not.toContain('chapter.key');
  });

  it('encodes the session so it cannot break the playlist', () => {
    expect(rewritePlaylist(playlist, 'a"b')).toContain('URI="key?session=a%22b"');
  });

  it('refuses a playlist that points anywhere but its own segments', () => {
    expect(() => rewritePlaylist('#EXTM3U\nhttps://elsewhere.example/seg.ts\n', 'abc')).toThrow(/Unexpected/);
  });
});
