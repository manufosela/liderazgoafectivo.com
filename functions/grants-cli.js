import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { createGrant, listGrants, revokeGrant } from './grants-admin.js';

const KEY_VARIABLE = 'AUDIOBOOK_FINGERPRINT_KEY';
const USAGE = `Usage:
  grants create --email <email> --note <note>
  grants list
  grants revoke <short-id>`;

const formatGrant = ({ shortId, status, createdAt, note }) => `${shortId}  ${status.padEnd(7)}  ${createdAt.toISOString().slice(0, 10)}  ${note}`;

/**
 * Admin commands over the audiobook grants. Run only by the author, never deployed.
 * @param {string[]} argv
 * @param {{grants: object, env: Record<string, string | undefined>, now: () => Date, print: (line: string) => void}} deps
 */
export const run = async (argv, { grants, env, now, print }) => {
  const { positionals, values } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: { email: { type: 'string' }, note: { type: 'string' } },
  });
  const [command, shortId] = positionals;

  if (command === 'create') {
    const secret = env[KEY_VARIABLE];
    if (!secret) throw new Error(`Set ${KEY_VARIABLE} with the fingerprint key from Secret Manager`);
    const grant = await createGrant({ email: values.email, note: values.note }, { grants, secret, now: now() });
    print(`Code (shown only now, give it to the person): ${grant.code}`);
    print(`Short id, to revoke it later: ${grant.shortId}`);
  } else if (command === 'list') {
    const listed = await listGrants({ grants });
    (listed.length ? listed.map(formatGrant) : ['No grants yet']).forEach((line) => print(line));
  } else if (command === 'revoke') {
    await revokeGrant(shortId, { grants, now: now() });
    print(`Revoked ${shortId}`);
  } else {
    throw new Error(USAGE);
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { getAudiobookDatabase } = await import('./database.js');
  const { createFirestoreGrantStore } = await import('./grant-store.js');
  const grants = createFirestoreGrantStore(getAudiobookDatabase());
  await run(process.argv.slice(2), { grants, env: process.env, now: () => new Date(), print: (line) => console.log(line) }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
