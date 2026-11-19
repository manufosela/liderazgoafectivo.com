import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { run } from './package-cli.js';

const env = { AUDIOBOOK_MEDIA_KEY: 'media-key-with-at-least-32-characters' };
let work;

const setUpSource = async (names) => {
  const source = join(work, 'source');
  await mkdir(source);
  await Promise.all(names.map((name) => writeFile(join(source, name), '')));
  const manifest = join(work, 'manifest.tsv');
  await writeFile(manifest, 'n\tparte\tcapitulo\tcaracteres\tpalabras\n0\t\tApertura\t244\t37\n1\tPrólogo\tPrólogo\t3532\t622\n');
  return { source, manifest, output: join(work, 'output') };
};

// Fake ffmpeg: checks the key file it is given and writes a 12-second playlist.
const createFfmpeg = () => {
  const keyInfoPaths = [];
  const runFfmpeg = async (args) => {
    const keyInfoPath = args[args.indexOf('-hls_key_info_file') + 1];
    keyInfoPaths.push(keyInfoPath);
    const keyPath = (await readFile(keyInfoPath, 'utf8')).split('\n')[1];
    expect((await readFile(keyPath)).length).toBe(16);
    await writeFile(args.at(-1), '#EXTM3U\n#EXTINF:10.0,\nseg-0000.ts\n#EXTINF:2.0,\nseg-0001.ts\n');
  };
  return { runFfmpeg, keyInfoPaths };
};

const runWith = (paths, { probeDuration = async () => 12, environment = env, ffmpeg = createFfmpeg() } = {}) => {
  const lines = [];
  const argv = ['--source', paths.source, '--manifest', paths.manifest, '--output', paths.output, '--gain-db', '4.3'];
  return run(argv, { runFfmpeg: ffmpeg.runFfmpeg, probeDuration, env: environment, print: (line) => lines.push(line) }).then(() => lines);
};

beforeEach(async () => {
  work = await mkdtemp(join(tmpdir(), 'package-cli-test-'));
});

afterEach(async () => {
  await rm(work, { recursive: true, force: true });
});

describe('package CLI', () => {
  it('packages every chapter, writes the catalog and deletes the keys', async () => {
    const paths = await setUpSource(['000 Apertura.mp3', '001 Prólogo.mp3']);
    const ffmpeg = createFfmpeg();

    const lines = await runWith(paths, { ffmpeg });

    expect(JSON.parse(await readFile(join(paths.output, 'catalog.json'), 'utf8'))).toEqual({
      chapters: [
        { id: '000', title: 'Apertura', duration: 12 },
        { id: '001', title: 'Prólogo', duration: 12 },
      ],
    });
    expect(existsSync(join(paths.output, 'chapters', '001', 'index.m3u8'))).toBe(true);
    expect(existsSync(dirname(ffmpeg.keyInfoPaths[0]))).toBe(false);
    expect(lines.at(-1)).toMatch(/Packaged 2 chapters/);
  });

  it('stops on a chapter whose duration does not match its source, and still deletes the keys', async () => {
    const paths = await setUpSource(['000 Apertura.mp3', '001 Prólogo.mp3']);
    const ffmpeg = createFfmpeg();

    await expect(runWith(paths, { ffmpeg, probeDuration: async () => 20 })).rejects.toThrow(/Chapter 000/);
    expect(existsSync(dirname(ffmpeg.keyInfoPaths[0]))).toBe(false);
  });

  it.each([
    [['000 Apertura.mp3'], /Found 1 MP3/],
    [['000 Apertura.mp3', '002 Prefacio.mp3'], /not chapter 001/],
  ])('refuses source files %o that do not match the manifest', async (names, message) => {
    await expect(runWith(await setUpSource(names))).rejects.toThrow(message);
  });

  it('refuses to run without the media key, without options or into the repository', async () => {
    const paths = await setUpSource(['000 Apertura.mp3', '001 Prólogo.mp3']);

    await expect(runWith(paths, { environment: {} })).rejects.toThrow(/AUDIOBOOK_MEDIA_KEY/);
    await expect(run([], { env, print: () => {} })).rejects.toThrow(/Usage/);
    await expect(runWith({ ...paths, output: join(import.meta.dirname, 'audio') })).rejects.toThrow(/outside the repository/);
  });

  it('refuses an output reached through a symlink that points into the repository', async () => {
    const paths = await setUpSource(['000 Apertura.mp3', '001 Prólogo.mp3']);
    const link = join(work, 'looks-outside');
    await symlink(import.meta.dirname, link);

    await expect(runWith({ ...paths, output: join(link, 'new', 'audio') })).rejects.toThrow(/outside the repository/);
    expect(existsSync(join(import.meta.dirname, 'new'))).toBe(false);
  });
});
