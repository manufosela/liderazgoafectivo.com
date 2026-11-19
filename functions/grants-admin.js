import { randomInt } from 'node:crypto';
import { AccessDeniedError, createGrantRecord } from './access.js';

// Crockford base32: no I, L, O or U, so a code read aloud or copied by hand stays unambiguous.
const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_LENGTH = 12;
const CODE_GROUP = 4;
const NOTE_MAX_LENGTH = 80;
const SHORT_ID = /^[0-9a-f]{8}$/;

const shortIdOf = (id) => id.slice(0, 8);

/** @param {(max: number) => number} [pick] random index source, injectable for tests */
export const generateCode = (pick = randomInt) => {
  const characters = Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[pick(CODE_ALPHABET.length)]);
  return Array.from({ length: CODE_LENGTH / CODE_GROUP }, (_, group) =>
    characters.slice(group * CODE_GROUP, (group + 1) * CODE_GROUP).join(''),
  ).join('-');
};

const normaliseNote = (note) => {
  const trimmed = typeof note === 'string' ? note.trim() : '';
  if (!trimmed || trimmed.length > NOTE_MAX_LENGTH) {
    throw new Error(`The note must have between 1 and ${NOTE_MAX_LENGTH} characters`);
  }
  return trimmed;
};

/**
 * Creates a grant for one person. The returned code is the only time it can be read.
 * @returns {Promise<{code: string, shortId: string}>}
 */
export const createGrant = async ({ email, note }, { grants, secret, now, pick }) => {
  const checkedNote = normaliseNote(note);
  const code = generateCode(pick);
  let grant;
  try {
    grant = createGrantRecord({ code, email }, { secret, now });
  } catch (error) {
    if (error instanceof AccessDeniedError) throw new Error('The email is not valid');
    throw error;
  }
  await grants.create(grant.id, { ...grant.record, note: checkedNote });
  return { code, shortId: shortIdOf(grant.id) };
};

/** @returns {Promise<Array<{shortId: string, note: string, createdAt: Date, status: 'active' | 'revoked'}>>} */
export const listGrants = async ({ grants }) =>
  (await grants.list())
    .map(({ id, note, createdAt, revoked }) => ({ shortId: shortIdOf(id), note, createdAt, status: revoked === false ? 'active' : 'revoked' }))
    .toSorted((first, second) => first.createdAt - second.createdAt);

/** Revokes the single grant whose id starts with the short id shown by listGrants. */
export const revokeGrant = async (shortId, { grants, now }) => {
  if (!SHORT_ID.test(shortId)) throw new Error('The short id must be 8 hexadecimal characters');
  const matches = (await grants.list()).filter(({ id }) => id.startsWith(shortId));
  if (matches.length === 0) throw new Error(`No grant matches ${shortId}`);
  if (matches.length > 1) throw new Error(`More than one grant matches ${shortId}`);
  await grants.revoke(matches[0].id, now);
};
