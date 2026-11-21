import Hls from 'hls.js/light';
import { createProgressStore, createRateStore, fetchCatalog, mediaUrl, nextChapterId } from './player-model.js';
import { markCurrent, renderChapters, resumeLabel } from './player-view.js';

const SAVE_EVERY_SECONDS = 5;

// Some browsers throw on the localStorage getter itself: nothing is remembered then.
const openStore = (create, blocked) => {
  try {
    return create(globalThis.localStorage);
  } catch {
    return blocked;
  }
};
const openProgressStore = () => openStore(createProgressStore, { save: () => false, load: () => null });
const openRateStore = () => openStore(createRateStore, { save: () => false, load: () => 1 });

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
  const resume = root.querySelector('[data-resume]');
  const progress = openProgressStore();
  let lastSaved = 0;
  const showProblem = (reason) => {
    status.textContent = copy[reason];
  };

  const catalog = await fetchCatalog(session.token);
  if (!catalog.ok) return showProblem(catalog.reason);
  const { chapters } = catalog;
  const native = audio.canPlayType('application/vnd.apple.mpegurl') !== '';
  let hls = null;
  let current = null;

  const play = (id, position = 0) => {
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
    audio.addEventListener(
      'loadedmetadata',
      () => {
        audio.currentTime = position;
        // A new source may come back at normal speed; the chosen one is the default rate.
        audio.playbackRate = audio.defaultPlaybackRate;
        audio.play().catch(() => {});
      },
      { once: true },
    );
    nowPlaying.textContent = current.title;
    markCurrent(list, id);
  };

  // Browsers keep the pitch when the rate changes, so a slower voice does not sound deeper.
  const rateSelect = root.querySelector('[data-rate]');
  const rates = openRateStore();
  const applyRate = (rate) => {
    audio.defaultPlaybackRate = rate;
    audio.playbackRate = rate;
    rateSelect.value = String(rate);
  };
  applyRate(rates.load());
  rateSelect.addEventListener('change', () => {
    const rate = Number(rateSelect.value);
    applyRate(rate);
    rates.save(rate);
  });

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
  // Only the chapter id and the whole second are kept on this device, never the session.
  audio.addEventListener('timeupdate', () => {
    if (!current || Math.abs(audio.currentTime - lastSaved) < SAVE_EVERY_SECONDS) return;
    lastSaved = audio.currentTime;
    progress.save({ chapterId: current.id, position: audio.currentTime });
  });

  const saved = progress.load();
  const savedChapter = chapters.find((chapter) => chapter.id === saved?.chapterId);
  if (savedChapter) {
    resume.textContent = resumeLabel(copy.resume, savedChapter, saved.position);
    resume.hidden = false;
    resume.addEventListener('click', () => {
      resume.hidden = true;
      play(savedChapter.id, saved.position);
    });
  }
  setTimeout(() => showProblem('expired'), new Date(session.expiresAt) - Date.now());
};
