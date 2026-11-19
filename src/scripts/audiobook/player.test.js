// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const hls = vi.hoisted(() => ({ instances: [] }));

vi.mock('hls.js/light', () => ({
  default: class {
    static Events = { ERROR: 'hlsError' };
    constructor() {
      hls.instances.push(this);
    }
    on(event, handler) {
      this[event] = handler;
    }
    loadSource(source) {
      this.source = source;
    }
    attachMedia() {}
    destroy() {}
  },
}));

const { startPlayer } = await import('./player.js');

const chapters = [
  { id: '000', title: 'Apertura', duration: 16.9 },
  { id: '001', title: 'Prólogo', duration: 240.2 },
];
const session = { token: 'a.b', expiresAt: new Date(Date.now() + 60_000).toISOString() };
const copy = { expired: 'caducada', unavailable: 'no disponible', network: 'sin red', resume: 'Continuar {title} en {time}' };
const statusOf = (root) => root.querySelector('[data-status]').textContent;

const buildRoot = ({ native = false } = {}) => {
  document.body.innerHTML = `<section><p data-now-playing></p><audio controls></audio><button data-resume hidden></button><p data-status></p><ol data-chapters></ol></section>`;
  const root = document.querySelector('section');
  const audio = root.querySelector('audio');
  audio.canPlayType = () => (native ? 'maybe' : '');
  audio.play = vi.fn(async () => {});
  return { root, audio };
};

const serveCatalog = (status = 200, body = { chapters }) => vi.stubGlobal('fetch', vi.fn(async () => ({ status, json: async () => body })));

const clickChapter = (root, id) => root.querySelector(`button[data-id="${id}"]`).click();

beforeEach(() => {
  hls.instances.length = 0;
  localStorage.clear();
  serveCatalog();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('startPlayer', () => {
  it('lists the chapters and loads only the chosen one through hls.js with the session', async () => {
    const { root, audio } = buildRoot();
    await startPlayer({ root, session, copy });

    expect(root.querySelectorAll('[data-chapters] button')).toHaveLength(2);
    expect(hls.instances).toHaveLength(0);
    clickChapter(root, '001');
    audio.dispatchEvent(new Event('loadedmetadata'));

    expect(hls.instances[0].source).toMatch(/\/audio\/chapters\/001\/index\.m3u8\?session=a\.b$/);
    expect(root.querySelector('[data-now-playing]').textContent).toBe('Prólogo');
    expect(root.querySelector('button[data-id="001"]').getAttribute('aria-current')).toBe('true');
    expect(audio.play).toHaveBeenCalled();
  });

  it('plays HLS natively on Safari and goes on with the next chapter when one ends', async () => {
    const { root, audio } = buildRoot({ native: true });
    await startPlayer({ root, session, copy });

    clickChapter(root, '000');
    expect(audio.src).toContain('/chapters/000/index.m3u8?session=a.b');
    audio.dispatchEvent(new Event('ended'));

    expect(audio.src).toContain('/chapters/001/index.m3u8');
    expect(hls.instances).toHaveLength(0);
  });

  it.each([
    [401, 'caducada'],
    [500, 'no disponible'],
  ])('shows the catalog failure %i to the listener', async (status, text) => {
    serveCatalog(status, {});
    const { root } = buildRoot();

    await startPlayer({ root, session, copy });

    expect(root.querySelector('[data-status]').textContent).toBe(text);
  });

  it.each([
    [{ fatal: true, response: { code: 401 } }, 'caducada'],
    [{ fatal: true, type: 'networkError', response: { code: 0 } }, 'sin red'],
    [{ fatal: true, type: 'mediaError' }, 'no disponible'],
    [{ fatal: false, response: { code: 401 } }, ''],
  ])('tells the listener why hls.js stopped: %o', async (error, text) => {
    const { root } = buildRoot();
    await startPlayer({ root, session, copy });
    clickChapter(root, '000');

    hls.instances[0].hlsError(null, error);

    expect(statusOf(root)).toBe(text);
  });

  it('reports a native playback failure; expiry has its own timed warning', async () => {
    const { root, audio } = buildRoot({ native: true });
    await startPlayer({ root, session, copy });
    clickChapter(root, '000');

    audio.dispatchEvent(new Event('error'));

    expect(statusOf(root)).toBe('no disponible');
  });

  it('remembers where the listener is, without the session, and offers to resume there next time', async () => {
    const first = buildRoot();
    await startPlayer({ root: first.root, session, copy });
    clickChapter(first.root, '001');
    first.audio.currentTime = 93.6;
    first.audio.dispatchEvent(new Event('timeupdate'));
    expect(JSON.stringify({ ...localStorage })).not.toContain(session.token);

    const second = buildRoot();
    await startPlayer({ root: second.root, session, copy });
    const resume = second.root.querySelector('[data-resume]');
    expect([resume.hidden, resume.textContent]).toEqual([false, 'Continuar Prólogo en 1:33']);
    resume.click();
    second.audio.dispatchEvent(new Event('loadedmetadata'));

    expect([second.audio.currentTime, resume.hidden]).toEqual([93, true]);
  });

  it('offers nothing to resume on a first visit', async () => {
    const { root } = buildRoot();

    await startPlayer({ root, session, copy });

    expect(root.querySelector('[data-resume]').hidden).toBe(true);
  });

  it('warns when the two-hour session runs out', async () => {
    vi.useFakeTimers();
    const { root } = buildRoot();
    await startPlayer({ root, session, copy });

    vi.advanceTimersByTime(60_000);

    expect(statusOf(root)).toBe('caducada');
    vi.useRealTimers();
  });
});
