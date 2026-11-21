import { requestSession } from './access.js';

/**
 * How the listener gets in: straight to the player with the pass this browser keeps,
 * or once with the code and email, which leaves a pass for the next visit.
 * The form only shows when there is no pass or the pass was refused.
 * @param {{access: HTMLElement, form: HTMLFormElement, message: HTMLElement, player: HTMLElement, welcome: HTMLElement,
 *   devices: {save: (device: string) => boolean, load: () => string | null, forget: () => boolean},
 *   request?: typeof requestSession, copy: DOMStringMap}} options
 */
export const startEntry = async ({ access, form, message, player, welcome, devices, request = requestSession, copy }) => {
  const button = form.querySelector('button[type="submit"]');

  const enter = ({ session, device }) => {
    devices.save(device);
    access.hidden = true;
    player.hidden = false;
    welcome.focus();
    // The player listens for this event; the session never leaves memory.
    player.dispatchEvent(new CustomEvent('audiobook:session', { detail: session }));
  };

  const setBusy = (busy) => {
    button.disabled = busy;
    button.textContent = busy ? copy.submitting : copy.submit;
    form.toggleAttribute('aria-busy', busy);
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    message.textContent = '';
    setBusy(true);
    const result = await request({ code: String(data.get('code')), email: String(data.get('email')) });
    setBusy(false);
    if (result.ok) enter(result);
    else message.textContent = copy[result.reason];
  });

  const pass = devices.load();
  if (!pass) {
    access.hidden = false;
    return;
  }
  const result = await request({ device: pass });
  if (result.ok) return enter(result);
  // A refused pass (revoked code or expired) is forgotten; the service being down is not the pass's fault.
  if (result.reason === 'accessDenied') devices.forget();
  else message.textContent = copy[result.reason];
  access.hidden = false;
};
