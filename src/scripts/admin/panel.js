import { AdminRequestError } from './api.js';
import { renderGrants } from './view.js';

/**
 * Wires the admin page: sign in with Google and list the codes.
 * Only an AdminRequestError is turned into a message; anything else is a bug and surfaces.
 * @param {{
 *   root: HTMLElement,
 *   auth: {onUser: (listener: (user: object | null) => Promise<void>) => void, signIn: () => Promise<void>, signOut: () => Promise<void>},
 *   api: {listGrants: () => Promise<object[]>},
 *   copy: Record<string, string>,
 * }} deps
 */
export const startPanel = ({ root, auth, api, copy }) => {
  const $ = (selector) => root.querySelector(selector);
  const [status, login, panel, grants] = ['[data-status]', '[data-login]', '[data-panel]', '[data-grants]'].map($);
  const labels = { statusLabels: { active: copy.active, revoked: copy.revoked }, revokeLabel: copy.revoke };

  const show = (text) => {
    status.textContent = text;
  };
  const explain = async (error) => {
    if (!(error instanceof AdminRequestError)) throw error;
    if (error.reason === 'notAdmin') await auth.signOut();
    show(copy[error.reason]);
  };
  const refresh = async () => renderGrants(grants, await api.listGrants(), labels);
  const attempt = (action) => action().catch(explain);

  auth.onUser(async (user) => {
    login.hidden = Boolean(user);
    panel.hidden = !user;
    if (user) await attempt(refresh);
  });

  $('[data-sign-in]').addEventListener('click', () => {
    show('');
    auth.signIn().catch(() => show(copy.signInFailed));
  });
  $('[data-sign-out]').addEventListener('click', () => auth.signOut());
};
