/** Cloud Function that turns a code and an email, or this browser's pass, into a two-hour listening session. */
export const START_SESSION_URL = 'https://europe-west1-comunidad-liderazgoafectivo.cloudfunctions.net/startSession';
const DEVICE_KEY = 'audiobook-device';

// The reasons never say which field was wrong: the service answers every refused code the same way.
const REASONS = { 401: 'accessDenied', 429: 'tooManyAttempts' };

/**
 * @param {{code: string, email: string} | {device: string}} access the code and email, or this browser's pass
 * @param {{fetch?: typeof fetch, url?: string}} [options]
 * @returns {Promise<{ok: true, session: {token: string, expiresAt: string}, device: string} | {ok: false, reason: 'accessDenied' | 'tooManyAttempts' | 'unavailable' | 'network'}>}
 */
export const requestSession = async (access, { fetch: send = globalThis.fetch, url = START_SESSION_URL } = {}) => {
  let response;
  try {
    response = await send(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(access) });
  } catch {
    return { ok: false, reason: 'network' };
  }
  if (response.status !== 200) return { ok: false, reason: REASONS[response.status] ?? 'unavailable' };
  const body = await response.json().catch(() => null);
  if (![body?.token, body?.expiresAt, body?.device].every((value) => typeof value === 'string')) return { ok: false, reason: 'unavailable' };
  return { ok: true, session: { token: body.token, expiresAt: body.expiresAt }, device: body.device };
};

/**
 * Keeps this browser's pass, never the code nor the email, and never the session, which stays in memory.
 * The pass is useless once the code is revoked. Storage may be blocked; then nothing is remembered.
 * @param {Storage} storage
 */
export const createDeviceStore = (storage) => {
  const attempt = (action, failed) => {
    try {
      return action();
    } catch {
      return failed;
    }
  };
  return {
    save: (device) =>
      attempt(() => {
        storage.setItem(DEVICE_KEY, device);
        return true;
      }, false),
    load: () => attempt(() => storage.getItem(DEVICE_KEY), null),
    forget: () =>
      attempt(() => {
        storage.removeItem(DEVICE_KEY);
        return true;
      }, false),
  };
};
