/** Cloud Function that creates, lists and revokes audiobook codes for a signed-in admin. */
export const ADMIN_URL = 'https://europe-west1-comunidad-liderazgoafectivo.cloudfunctions.net/admin';

const REASONS = { 400: 'invalidInput', 401: 'notAdmin', 404: 'notFound' };

/** A refused or failed admin request; `reason` picks the message shown to the admin. */
export class AdminRequestError extends Error {
  /** @param {'invalidInput' | 'notAdmin' | 'notFound' | 'unavailable' | 'network'} reason */
  constructor(reason) {
    super(`Admin request failed: ${reason}`);
    this.name = 'AdminRequestError';
    this.reason = reason;
  }
}

/**
 * @param {{getToken: () => Promise<string>, fetch?: typeof fetch, base?: string}} deps
 */
export const createAdminApi = ({ getToken, fetch: send = globalThis.fetch, base = ADMIN_URL }) => {
  const call = async (path, { method = 'GET', body } = {}) => {
    const headers = { Authorization: `Bearer ${await getToken()}` };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    let response;
    try {
      response = await send(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch {
      throw new AdminRequestError('network');
    }
    if (!response.ok) throw new AdminRequestError(REASONS[response.status] ?? 'unavailable');
    return response.status === 204 ? null : response.json();
  };

  return {
    /** @returns {Promise<Array<{shortId: string, note: string, createdAt: Date, status: 'active' | 'revoked'}>>} */
    listGrants: async () => {
      const body = await call('/grants');
      if (!Array.isArray(body?.grants)) throw new AdminRequestError('unavailable');
      return body.grants.map((grant) => ({ ...grant, createdAt: new Date(grant.createdAt) }));
    },
    /** @returns {Promise<{code: string, shortId: string}>} the code, readable only now */
    createGrant: ({ email, note }) => call('/grants', { method: 'POST', body: { email, note } }),
    revokeGrant: (shortId) => call(`/grants/${encodeURIComponent(shortId)}/revoke`, { method: 'POST' }),
  };
};
