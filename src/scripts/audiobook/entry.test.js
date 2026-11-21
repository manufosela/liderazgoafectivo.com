// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { startEntry } from './entry.js';

const session = { token: 'abc.def', expiresAt: '2026-11-19T12:00:00.000Z' };
const copy = { submit: 'Entrar', submitting: 'Entrando', accessDenied: 'denegado', unavailable: 'no disponible', network: 'sin red' };

let root;
let sessions;
const $ = (selector) => root.querySelector(selector);

const createDevices = (pass = null) => {
  let stored = pass;
  return { save: vi.fn((device) => (stored = device)), load: () => stored, forget: vi.fn(() => (stored = null)), stored: () => stored };
};

const start = (devices, request) =>
  startEntry({ access: $('#access'), form: $('form'), message: $('#message'), player: $('#player'), welcome: $('#welcome'), devices, request, copy });

const fillAndSubmit = () => {
  $('[name="email"]').value = 'lectora@example.com';
  $('[name="code"]').value = 'K7QM-2XPA-9RTD';
  $('form').dispatchEvent(new Event('submit', { cancelable: true }));
};

beforeEach(() => {
  document.body.innerHTML = `<main>
    <section id="access" hidden><form><input name="email" required><input name="code" required><p id="message"></p><button type="submit">Entrar</button></form></section>
    <section id="player" hidden><p id="welcome" tabindex="-1"></p></section></main>`;
  root = document.querySelector('main');
  sessions = [];
  $('#player').addEventListener('audiobook:session', ({ detail }) => sessions.push(detail));
});

describe('startEntry', () => {
  it('goes straight to the player with the pass this browser keeps, and keeps the renewed one', async () => {
    const devices = createDevices('old.pass');
    const request = vi.fn(async () => ({ ok: true, session, device: 'new.pass' }));

    await start(devices, request);

    expect(request).toHaveBeenCalledWith({ device: 'old.pass' });
    expect([$('#access').hidden, $('#player').hidden, sessions, devices.stored()]).toEqual([true, false, [session], 'new.pass']);
  });

  it('shows the form on a first visit', async () => {
    const request = vi.fn();

    await start(createDevices(), request);

    expect([$('#access').hidden, $('#player').hidden, request.mock.calls.length]).toEqual([false, true, 0]);
  });

  it('forgets a refused pass and asks for the code again, without an error', async () => {
    const devices = createDevices('revoked.pass');

    await start(devices, async () => ({ ok: false, reason: 'accessDenied' }));

    expect([$('#access').hidden, devices.stored(), $('#message').textContent]).toEqual([false, null, '']);
  });

  it('keeps the pass when the service is only unreachable, and says so', async () => {
    const devices = createDevices('good.pass');

    await start(devices, async () => ({ ok: false, reason: 'network' }));

    expect([$('#access').hidden, devices.stored(), $('#message').textContent]).toEqual([false, 'good.pass', 'sin red']);
  });

  it('enters with the code and email once, and keeps the pass for the next visit', async () => {
    const devices = createDevices();
    const request = vi.fn(async () => ({ ok: true, session, device: 'first.pass' }));
    await start(devices, request);

    fillAndSubmit();
    await vi.waitFor(() => expect(sessions).toEqual([session]));

    expect(request).toHaveBeenCalledWith({ code: 'K7QM-2XPA-9RTD', email: 'lectora@example.com' });
    expect([$('#access').hidden, devices.stored()]).toEqual([true, 'first.pass']);
  });

  it('tells why the code was refused and lets the listener try again', async () => {
    await start(createDevices(), async () => ({ ok: false, reason: 'accessDenied' }));

    fillAndSubmit();
    await vi.waitFor(() => expect($('#message').textContent).toBe('denegado'));

    expect([$('button').disabled, $('button').textContent]).toEqual([false, 'Entrar']);
  });
});
