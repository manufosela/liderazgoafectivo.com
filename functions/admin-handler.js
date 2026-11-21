import { NotAdminError } from './admin-auth.js';
import { GrantInputError, GrantNotFoundError, createGrant, listGrants, revokeGrant } from './grants-admin.js';
import { ALLOWED_ORIGINS } from './start-session.js';

const REVOKE_PATH = /^\/grants\/([^/]+)\/revoke$/;

const refuse = (response, status, error) => response.status(status).json({ error });

const findRoute = (method, path) => {
  if (path === '/grants' && method === 'GET') return { action: 'list' };
  if (path === '/grants' && method === 'POST') return { action: 'create' };
  const revoke = method === 'POST' ? REVOKE_PATH.exec(path) : null;
  return revoke ? { action: 'revoke', shortId: revoke[1] } : null;
};

const run = async ({ action, shortId }, request, response, { grants, fingerprintKey, now }) => {
  if (action === 'list') {
    const listed = await listGrants({ grants });
    return response.status(200).json({ grants: listed.map((grant) => ({ ...grant, createdAt: grant.createdAt.toISOString() })) });
  }
  if (action === 'create') {
    const { email, note } = request.body ?? {};
    return response.status(201).json(await createGrant({ email, note }, { grants, secret: fingerprintKey(), now: now() }));
  }
  await revokeGrant(shortId, { grants, now: now() });
  return response.status(204).send('');
};

/**
 * HTTP handler of the audiobook admin, only for the book's website and only for a verified admin:
 * GET /grants lists, POST /grants {email, note} creates (the code is returned only here),
 * POST /grants/<short id>/revoke revokes.
 * @param {{verifyAdmin: (authorization: string | undefined) => Promise<string>, grants: object, fingerprintKey: () => string, now: () => Date}} deps
 */
export const createAdminHandler = (deps) => async (request, response) => {
  const origin = request.get('origin');
  if (!ALLOWED_ORIGINS.has(origin)) return refuse(response, 403, 'forbidden_origin');
  response.set('Access-Control-Allow-Origin', origin).set('Vary', 'Origin').set('Cache-Control', 'no-store');

  if (request.method === 'OPTIONS') {
    response.set('Access-Control-Allow-Methods', 'GET, POST').set('Access-Control-Allow-Headers', 'Authorization, Content-Type').set('Access-Control-Max-Age', '3600');
    return response.status(204).send('');
  }

  try {
    await deps.verifyAdmin(request.get('authorization'));
    const route = findRoute(request.method, request.path);
    if (!route) return refuse(response, 404, 'not_found');
    return await run(route, request, response, deps);
  } catch (error) {
    if (error instanceof NotAdminError) return refuse(response, 401, 'not_admin');
    if (error instanceof GrantInputError) return response.status(400).json({ error: 'invalid_input', message: error.message });
    if (error instanceof GrantNotFoundError) return refuse(response, 404, 'grant_not_found');
    throw error;
  }
};
