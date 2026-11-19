/** Cloud Function that turns a code and an email into a two-hour listening session. */
export const START_SESSION_URL = 'https://europe-west1-comunidad-liderazgoafectivo.cloudfunctions.net/startSession';

// The reasons never say which field was wrong: the service answers every refused code the same way.
const REASONS = { 401: 'accessDenied', 429: 'tooManyAttempts' };

/**
 * @param {{code: string, email: string}} access
 * @param {{fetch?: typeof fetch, url?: string}} [options]
 * @returns {Promise<{ok: true, session: {token: string, expiresAt: string}} | {ok: false, reason: 'accessDenied' | 'tooManyAttempts' | 'unavailable' | 'network'}>}
 */
export const requestSession = async ({ code, email }, { fetch: send = globalThis.fetch, url = START_SESSION_URL } = {}) => {
  let response;
  try {
    response = await send(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, email }) });
  } catch {
    return { ok: false, reason: 'network' };
  }
  if (response.status !== 200) return { ok: false, reason: REASONS[response.status] ?? 'unavailable' };
  // The session stays in memory only: Web Storage would expose it to any script running on the page.
  const body = await response.json().catch(() => null);
  if (typeof body?.token !== 'string' || typeof body?.expiresAt !== 'string') return { ok: false, reason: 'unavailable' };
  return { ok: true, session: { token: body.token, expiresAt: body.expiresAt } };
};
