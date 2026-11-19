import { describe, expect, it } from 'vitest';
import { SESSION_TTL_MS, SessionError, issueSession, verifySession } from './session.js';

const key = 'session-key-with-at-least-32-characters';
const now = new Date('2026-11-19T10:00:00Z');
const grantId = 'a'.repeat(64);
const activeGrants = { get: async (id) => (id === grantId ? { revoked: false } : null) };

const at = (milliseconds) => new Date(now.getTime() + milliseconds);

const rejects = (promise) => expect(promise).rejects.toBeInstanceOf(SessionError);

describe('issueSession and verifySession', () => {
  it('issues a session that is valid for two hours', async () => {
    const { token, expiresAt } = issueSession(grantId, { key, now });

    expect(expiresAt).toEqual(at(2 * 60 * 60 * 1000));
    await expect(verifySession(token, { key, now: at(SESSION_TTL_MS - 1), grants: activeGrants })).resolves.toEqual({ grantId, expiresAt });
    await rejects(verifySession(token, { key, now: at(SESSION_TTL_MS), grants: activeGrants }));
  });

  it('rejects a token whose payload or tag was changed', async () => {
    const { token } = issueSession(grantId, { key, now });
    const [payload, tag] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ grantId, expiresAt: at(SESSION_TTL_MS * 10).getTime() })).toString('base64url');

    await rejects(verifySession(`${forged}.${tag}`, { key, now, grants: activeGrants }));
    await rejects(verifySession(`${payload}.${tag.slice(1)}x`, { key, now, grants: activeGrants }));
  });

  it('rejects a token signed with another key', async () => {
    const { token } = issueSession(grantId, { key: 'another-key-with-at-least-32-characters', now });

    await rejects(verifySession(token, { key, now, grants: activeGrants }));
  });

  it.each([[undefined], [''], ['no-dot'], ['a.b.c'], ['.tag']])('rejects the malformed token %o', async (token) => {
    await rejects(verifySession(token, { key, now, grants: activeGrants }));
  });

  it('stops working once the grant is revoked', async () => {
    const { token } = issueSession(grantId, { key, now });
    const revokedGrants = { get: async () => ({ revoked: true }) };

    await rejects(verifySession(token, { key, now, grants: revokedGrants }));
  });

  it('fails loudly when the key is too short', () => {
    expect(() => issueSession(grantId, { key: 'short', now })).toThrow(/key/);
  });
});
