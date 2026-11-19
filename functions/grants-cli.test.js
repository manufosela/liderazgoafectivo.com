import { describe, expect, it } from 'vitest';
import { validateAccess } from './access.js';
import { run } from './grants-cli.js';

const secret = 'test-secret-with-at-least-32-characters';
const env = { AUDIOBOOK_FINGERPRINT_KEY: secret };
const now = () => new Date('2026-11-19T10:00:00Z');

const createMemoryStore = () => {
  const grants = new Map();
  return {
    get: async (id) => grants.get(id) ?? null,
    create: async (id, record) => grants.set(id, record),
    list: async () => [...grants].map(([id, record]) => ({ id, ...record })),
    revoke: async (id, revokedAt) => grants.set(id, { ...grants.get(id), revoked: true, revokedAt }),
  };
};

const runWith = async (argv, grants, environment = env) => {
  const lines = [];
  await run(argv, { grants, env: environment, now, print: (line) => lines.push(line) });
  return lines;
};

describe('grants CLI', () => {
  it('creates a grant, prints its code once, lists it and revokes it', async () => {
    const grants = createMemoryStore();

    const created = await runWith(['create', '--email', 'lectora@example.com', '--note', 'Regalo'], grants);
    const code = created[0].match(/[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}/)[0];
    const shortId = created[1].match(/[0-9a-f]{8}/)[0];
    await expect(validateAccess({ code, email: 'lectora@example.com' }, { grants, secret })).resolves.toBeDefined();

    expect(await runWith(['list'], grants)).toEqual([`${shortId}  active   2026-11-19  Regalo`]);
    expect(await runWith(['revoke', shortId], grants)).toEqual([`Revoked ${shortId}`]);
    expect(await runWith(['list'], grants)).toEqual([`${shortId}  revoked  2026-11-19  Regalo`]);
  });

  it('says how to provide the key when it is missing', async () => {
    await expect(runWith(['create', '--email', 'lectora@example.com', '--note', 'Regalo'], createMemoryStore(), {})).rejects.toThrow(
      /AUDIOBOOK_FINGERPRINT_KEY/,
    );
  });

  it('prints a notice when there are no grants yet', async () => {
    expect(await runWith(['list'], createMemoryStore())).toEqual(['No grants yet']);
  });

  it.each([[[]], [['unknown']]])('shows the usage for %o', async (argv) => {
    await expect(runWith(argv, createMemoryStore())).rejects.toThrow(/Usage/);
  });
});
