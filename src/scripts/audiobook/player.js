import Hls from 'hls.js/light';
import { fetchCatalog, mediaUrl, nextChapterId } from './player-model.js';
import { markCurrent, renderChapters } from './player-view.js';

/** Which message a fatal hls.js error deserves: the service answers 401 once the session is over. */
const hlsProblem = (error) => {
  if (error.response?.code === 401) return 'expired';
  return error.type === 'networkError' ? 'network' : 'unavailable';
};

/**
 * Chapter player over the protected HLS service. Safari plays HLS natively; other browsers use hls.js.
 * @param {{root: HTMLElement, session: {token: string, expiresAt: string}, copy: DOMStringMap}} options
 */
export const startPlayer = async ({ root, session, copy }) => {
  const list = root.querySelector('[data-chapters]');
  const audio = root.querySelector('audio');
  const status = root.querySelector('[data-status]');
  const nowPlaying = root.querySelector('[data-now-playing]');
  const showProblem = (reason) => {
    status.textContent = copy[reason];
  };

  const catalog = await fetchCatalog(session.token);
  if (!catalog.ok) return showProblem(catalog.reason);
  const { chapters } = catalog;
  const native = audio.canPlayType('application/vnd.apple.mpegurl') !== '';
  let hls = null;
  let current = null;

  const play = (id) => {
    current = chapters.find((chapter) => chapter.id === id);
    const source = mediaUrl(`/chapters/${id}/index.m3u8`, session.token);
    status.textContent = '';
    hls?.destroy();
    if (native) {
      audio.src = source;
    } else {
      hls = new Hls();
      hls.on(Hls.Events.ERROR, (_, error) => error.fatal && showProblem(hlsProblem(error)));
      hls.loadSource(source);
      hls.attachMedia(audio);
    }
    // Autoplay may be refused by the browser; the listener then presses play on the visible control.
    audio.addEventListener('loadedmetadata', () => audio.play().catch(() => {}), { once: true });
    nowPlaying.textContent = current.title;
    markCurrent(list, id);
  };

  renderChapters(list, chapters);
  list.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-id]');
    if (button) play(button.dataset.id);
  });
  audio.addEventListener('contextmenu', (event) => event.preventDefault());
  // hls.js reports its own errors; this one only fires for native HLS (Safari).
  audio.addEventListener('error', () => native && showProblem('unavailable'));
  audio.addEventListener('ended', () => {
    const next = nextChapterId(chapters, current.id);
    if (next) play(next);
  });
  setTimeout(() => showProblem('expired'), new Date(session.expiresAt) - Date.now());
};
