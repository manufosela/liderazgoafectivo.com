// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { AdminRequestError } from './api.js';
import { startPanel } from './panel.js';

const copy = {
  active: 'Activo',
  revoked: 'Revocado',
  revoke: 'Revocar',
  unknownEmail: 'Sin correo',
  notAdmin: 'Sin permiso',
  invalidInput: 'Revisa los datos',
  notFound: 'No existe',
  unavailable: 'No disponible',
  network: 'Sin conexión',
  signInFailed: 'No se pudo entrar',
  copied: 'Copiado',
  copyFailed: 'No se pudo copiar',
  share: 'Entra en {url} con el código {code}',
  confirmRevoke: '¿Revocar {id}?',
};

const markup = `
  <p data-status></p>
  <section data-login><button type="button" data-sign-in>Entrar</button></section>
  <section data-panel hidden>
    <button type="button" data-sign-out>Salir</button>
    <form data-create><input name="email" type="email" required><input name="note" required><button type="submit">Crear</button></form>
    <div data-result hidden><textarea data-message readonly></textarea><button type="button" data-copy>Copiar</button></div>
    <table><tbody data-grants></tbody></table>
  </section>
  <dialog data-confirm>
    <p data-confirm-text></p>
    <button type="button" data-answer="cancel">Cancelar</button><button type="button" data-answer="confirm">Revocar</button>
  </dialog>`;

const createApi = () => {
  const grants = [];
  return {
    grants,
    listGrants: async () => grants.map((grant) => ({ ...grant })),
    createGrant: async ({ email, note }) => {
      if (note === 'rechazada') throw new AdminRequestError('invalidInput');
      if (note === 'fallo') throw new Error('bug');
      grants.push({ shortId: `abcd000${grants.length}`, email, note, createdAt: new Date('2026-11-21T10:00:00Z'), status: 'active' });
      return { code: 'AAAA-BBBB-CCCC', shortId: grants.at(-1).shortId };
    },
    revokeGrant: async (shortId) => {
      grants.find((grant) => grant.shortId === shortId).status = 'revoked';
      return null;
    },
  };
};

const setUp = ({ api = createApi(), signIn = async () => {}, writeText = async () => {} } = {}) => {
  const root = document.createElement('main');
  root.innerHTML = markup;
  const auth = { listener: null, signedOut: 0, signIn, onUser: (listener) => Object.assign(auth, { listener }), signOut: async () => { auth.signedOut += 1; await auth.listener(null); } };
  const clipboard = { written: [], writeText: async (text) => { clipboard.written.push(text); await writeText(text); } };
  const { submitGrant } = startPanel({ root, auth, api, copy, clipboard });
  const $ = (selector) => root.querySelector(selector);
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  const fill = (email, note) => {
    Object.assign($('[name="email"]'), { value: email });
    Object.assign($('[name="note"]'), { value: note });
  };
  const submit = async (email, note) => {
    fill(email, note);
    $('[data-create]').requestSubmit();
    await settle();
  };
  return { root, auth, api, clipboard, $, settle, fill, submit, submitGrant };
};

const rows = (body) => [...body.querySelectorAll('tr')].map((row) => [...row.querySelectorAll('td')].slice(0, 5).map((cell) => cell.textContent));

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
    api.grants.push(
      { shortId: 'abcd1234', email: null, note: 'Antiguo', createdAt: new Date('2026-11-19T10:00:00Z'), status: 'active' },
      { shortId: 'abcd5678', email: 'lectora@example.com', note: 'Regalo', createdAt: new Date('2026-11-20T10:00:00Z'), status: 'active' },
    );
    const { $, auth } = setUp({ api });

    await auth.listener({ email: 'autor@example.com' });

    expect([$('[data-login]').hidden, $('[data-panel]').hidden]).toEqual([true, false]);
    expect(rows($('[data-grants]'))).toEqual([
      ['abcd5678', 'lectora@example.com', 'Regalo', '20 nov 2026', 'Activo'],
      ['abcd1234', 'Sin correo', 'Antiguo', '19 nov 2026', 'Activo'],
    ]);
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

  it('creates a code, shows it once in a message ready to copy, and lists it', async () => {
    const { $, auth, clipboard, submit, settle } = setUp();
    await auth.listener({ email: 'autor@example.com' });

    await submit(' lectora@example.com ', 'Regalo');

    expect($('[data-result]').hidden).toBe(false);
    expect($('[data-message]').value).toBe('Entra en https://liderazgoafectivo.com/audiolibro con el código AAAA-BBBB-CCCC');
    expect($('[name="email"]').value).toBe('');
    expect(rows($('[data-grants]'))).toHaveLength(1);
    $('[data-copy]').click();
    await settle();
    expect(clipboard.written).toEqual([$('[data-message]').value]);
    expect($('[data-status]').textContent).toBe('Copiado');
  });

  it('explains a refused code and a failed copy', async () => {
    const { $, auth, submit, settle } = setUp({ writeText: async () => Promise.reject(new Error('denied')) });
    await auth.listener({ email: 'autor@example.com' });

    await submit('lectora@example.com', 'rechazada');
    expect([$('[data-status]').textContent, $('[data-result]').hidden]).toEqual(['Revisa los datos', true]);

    $('[data-copy]').click();
    await settle();
    expect($('[data-status]').textContent).toBe('No se pudo copiar');
  });

  it('enables the button again even when creating fails unexpectedly', async () => {
    const { $, auth, fill, submitGrant } = setUp();
    await auth.listener({ email: 'autor@example.com' });
    fill('lectora@example.com', 'fallo');

    await expect(submitGrant()).rejects.toThrow('bug');
    expect($('[data-create] button').disabled).toBe(false);
  });

  it.each([
    ['confirm', 'Revocado'],
    ['cancel', 'Activo'],
  ])('revokes a code only after confirming in the dialog (%s)', async (answer, status) => {
    const { $, auth, submit, settle } = setUp();
    await auth.listener({ email: 'autor@example.com' });
    await submit('lectora@example.com', 'Regalo');

    $('[data-grants] td').click();
    expect($('[data-confirm]').open).toBe(false);
    $('button[data-revoke]').click();
    expect($('[data-confirm]').open).toBe(true);
    expect($('[data-confirm-text]').textContent).toBe('¿Revocar abcd0000?');
    $(`[data-answer="${answer}"]`).click();
    await settle();

    expect($('[data-confirm]').open).toBe(false);

    expect(rows($('[data-grants]'))[0][4]).toBe(status);
  });

  it('lets unexpected failures surface', async () => {
    const api = { ...createApi(), listGrants: async () => Promise.reject(new Error('bug')) };
    const { auth } = setUp({ api });

    await expect(auth.listener({ email: 'autor@example.com' })).rejects.toThrow('bug');
  });
});
