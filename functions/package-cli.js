import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs, promisify } from 'node:util';
import { assertDuration, buildCatalog, chapterId, deriveChapterKey, hlsArguments, keyInfoFile, playlistDuration } from './packaging.js';

const REPOSITORY = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KEY_VARIABLE = 'AUDIOBOOK_MEDIA_KEY';
const USAGE = 'Usage: package-audio --source <mp3 folder> --manifest <manifest.tsv> --output <folder> --gain-db <dB>';

const parseManifest = (text) =>
  text
    .trim()
    .split('\n')
    .slice(1)
    .map((line) => {
      const [number, , title] = line.split('\t');
      return { number: Number(number), title };
    });

// Real path of a target that may not exist yet: resolve its nearest existing ancestor, symlinks included.
const realTarget = async (path) => {
  let existing = resolve(path);
  const missing = [];
  while (!existsSync(existing)) {
    missing.unshift(basename(existing));
    existing = dirname(existing);
  }
  return join(await realpath(existing), ...missing);
};

const insideRepository = async (path) => {
  const fromRepository = relative(await realpath(REPOSITORY), await realTarget(path));
  return !fromRepository.startsWith('..') && !isAbsolute(fromRepository);
};

const packageChapter = async ({ id, input, output, keys, mediaKey, gainDb, runFfmpeg, probeDuration }) => {
  const outputDir = join(output, 'chapters', id);
  const keyPath = join(keys, `${id}.key`);
  const keyInfoPath = join(keys, `${id}.keyinfo`);
  await mkdir(outputDir, { recursive: true });
  await writeFile(keyPath, deriveChapterKey(mediaKey, id), { mode: 0o600 });
  await writeFile(keyInfoPath, keyInfoFile(keyPath), { mode: 0o600 });
  await runFfmpeg(hlsArguments({ input, outputDir, keyInfoPath, gainDb }));
  const duration = playlistDuration(await readFile(join(outputDir, 'index.m3u8'), 'utf8'));
  assertDuration({ id, packaged: duration, source: await probeDuration(input) });
  return duration;
};

/**
 * Packages every chapter of the manifest as encrypted HLS into a folder outside the repository.
 * Chapter keys only ever exist in a temporary folder that is always deleted.
 */
export const run = async (argv, { runFfmpeg, probeDuration, env, print }) => {
  const { values } = parseArgs({
    args: argv,
    options: { source: { type: 'string' }, manifest: { type: 'string' }, output: { type: 'string' }, 'gain-db': { type: 'string' } },
  });
  const gainDb = Number(values['gain-db']);
  if (!values.source || !values.manifest || !values.output || !Number.isFinite(gainDb)) throw new Error(USAGE);
  const mediaKey = env[KEY_VARIABLE];
  if (!mediaKey) throw new Error(`Set ${KEY_VARIABLE} with the media key from Secret Manager`);
  if (await insideRepository(values.output)) throw new Error('The output folder must be outside the repository: it holds the audio');

  const chapters = parseManifest(await readFile(values.manifest, 'utf8'));
  const files = (await readdir(values.source)).filter((name) => name.endsWith('.mp3')).toSorted((first, second) => first.localeCompare(second));
  if (files.length !== chapters.length) throw new Error(`Found ${files.length} MP3 files for ${chapters.length} chapters`);

  const keys = await mkdtemp(join(tmpdir(), 'audiobook-keys-'));
  try {
    const packaged = [];
    for (const [index, { number, title }] of chapters.entries()) {
      const id = chapterId(number);
      if (!files[index].startsWith(`${id} `)) throw new Error(`${files[index]} is not chapter ${id}`);
      const input = join(values.source, files[index]);
      const duration = await packageChapter({ id, input, output: values.output, keys, mediaKey, gainDb, runFfmpeg, probeDuration });
      packaged.push({ id, title, duration });
      print(`${id} ${title}: ${duration.toFixed(1)} s`);
    }
    await writeFile(join(values.output, 'catalog.json'), `${JSON.stringify(buildCatalog(packaged), null, 2)}\n`);
    print(`Packaged ${packaged.length} chapters into ${values.output}`);
  } finally {
    await rm(keys, { recursive: true, force: true });
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const exec = promisify(execFile);
  const probeDuration = async (path) =>
    Number((await exec('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path])).stdout);
  await run(process.argv.slice(2), {
    runFfmpeg: (args) => exec('ffmpeg', args),
    probeDuration,
    env: process.env,
    print: (line) => console.log(line),
  }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
