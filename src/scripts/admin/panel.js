import { AdminRequestError } from './api.js';
import { renderGrants, shareMessage } from './view.js';

/** Page the person opens with the code they get. */
export const AUDIOBOOK_URL = 'https://liderazgoafectivo.com/audiolibro';

/**
 * Wires the admin page: sign in with Google, list the codes and create new ones.
 * Only an AdminRequestError is turned into a message; anything else is a bug and surfaces.
 * @param {{
 *   root: HTMLElement,
 *   auth: {onUser: (listener: (user: object | null) => Promise<void>) => void, signIn: () => Promise<void>, signOut: () => Promise<void>},
 *   api: {listGrants: () => Promise<object[]>, createGrant: (grant: {email: string, note: string}) => Promise<{code: string}>},
 *   copy: Record<string, string>,
 *   clipboard: {writeText: (text: string) => Promise<void>},
 * }} deps
 * @returns {{submitGrant: () => Promise<void>}} what the create form runs
 */
export const startPanel = ({ root, auth, api, copy, clipboard }) => {
  const $ = (selector) => root.querySelector(selector);
  const [status, login, panel, grants, form, result, message] = [
    '[data-status]', '[data-login]', '[data-panel]', '[data-grants]', '[data-create]', '[data-result]', '[data-message]',
  ].map($);
  const labels = { statusLabels: { active: copy.active, revoked: copy.revoked }, revokeLabel: copy.revoke };
  const submit = form.querySelector('button[type="submit"]');
  const field = (name) => form.elements.namedItem(name).value.trim();

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

  const submitGrant = async () => {
    submit.disabled = true;
    try {
      await attempt(async () => {
        const { code } = await api.createGrant({ email: field('email'), note: field('note') });
        message.value = shareMessage(copy.share, { url: AUDIOBOOK_URL, code });
        result.hidden = false;
        form.reset();
        show('');
        await refresh();
      });
    } finally {
      submit.disabled = false;
    }
  };
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submitGrant();
  });

  $('[data-copy]').addEventListener('click', () =>
    clipboard.writeText(message.value).then(
      () => show(copy.copied),
      () => show(copy.copyFailed),
    ),
  );

  return { submitGrant };
};
