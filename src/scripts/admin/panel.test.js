// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { AdminRequestError } from './api.js';
import { startPanel } from './panel.js';

const copy = {
  active: 'Activo',
  revoked: 'Revocado',
  revoke: 'Revocar',
  notAdmin: 'Sin permiso',
  invalidInput: 'Revisa los datos',
  notFound: 'No existe',
  unavailable: 'No disponible',
  network: 'Sin conexión',
  signInFailed: 'No se pudo entrar',
};

const markup = `
  <p data-status></p>
  <section data-login><button type="button" data-sign-in>Entrar</button></section>
  <section data-panel hidden>
    <button type="button" data-sign-out>Salir</button>
    <table><tbody data-grants></tbody></table>
  </section>`;

const createApi = () => {
  const grants = [];
  return { grants, listGrants: async () => grants.map((grant) => ({ ...grant })) };
};

const setUp = ({ api = createApi(), signIn = async () => {} } = {}) => {
  const root = document.createElement('main');
  root.innerHTML = markup;
  const auth = { listener: null, signedOut: 0, signIn, onUser: (listener) => Object.assign(auth, { listener }), signOut: async () => { auth.signedOut += 1; await auth.listener(null); } };
  startPanel({ root, auth, api, copy });
  const $ = (selector) => root.querySelector(selector);
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  return { root, auth, api, $, settle };
};

const rows = (body) => [...body.querySelectorAll('tr')].map((row) => [...row.querySelectorAll('td')].slice(0, 4).map((cell) => cell.textContent));

describe('admin panel', () => {
  it('asks to sign in while nobody is signed in, and says when signing in fails', async () => {
    const { $, auth, settle } = setUp({ signIn: async () => Promise.reject(new Error('auth/popup-closed-by-user')) });
    await auth.listener(null);

    $('[data-sign-in]').click();
    await settle();

    expect([$('[data-login]').hidden, $('[data-panel]').hidden]).toEqual([false, true]);
    expect($('[data-status]').textContent).toBe('No se pudo entrar');
  });

  it('shows the codes to a signed-in admin', async () => {
    const api = createApi();
    api.grants.push({ shortId: 'abcd1234', note: 'Regalo', createdAt: new Date('2026-11-20T10:00:00Z'), status: 'active' });
    const { $, auth } = setUp({ api });

    await auth.listener({ email: 'autor@example.com' });

    expect([$('[data-login]').hidden, $('[data-panel]').hidden]).toEqual([true, false]);
    expect(rows($('[data-grants]'))).toEqual([['abcd1234', 'Regalo', '20 nov 2026', 'Activo']]);
  });

  it('signs out from the panel', async () => {
    const { $, auth } = setUp();
    await auth.listener({ email: 'autor@example.com' });

    $('[data-sign-out]').click();

    expect(auth.signedOut).toBe(1);
  });

  it('signs out an account that is not an admin and says so', async () => {
    const api = { ...createApi(), listGrants: async () => Promise.reject(new AdminRequestError('notAdmin')) };
    const { $, auth } = setUp({ api });

    await auth.listener({ email: 'intrusa@example.com' });

    expect(auth.signedOut).toBe(1);
    expect($('[data-panel]').hidden).toBe(true);
    expect($('[data-status]').textContent).toBe('Sin permiso');
  });

  it('lets unexpected failures surface', async () => {
    const api = { ...createApi(), listGrants: async () => Promise.reject(new Error('bug')) };
    const { auth } = setUp({ api });

    await expect(auth.listener({ email: 'autor@example.com' })).rejects.toThrow('bug');
  });
});
