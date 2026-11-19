// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { markCurrent, renderChapters, resumeLabel } from './player-view.js';

const chapters = [
  { id: '000', title: 'Apertura', duration: 16.9 },
  { id: '001', title: 'Prólogo', duration: 240.2 },
];

describe('renderChapters', () => {
  it('lists every chapter as a keyboard button with its duration, and no link to any file', () => {
    const list = document.createElement('ol');

    renderChapters(list, chapters);

    const buttons = [...list.querySelectorAll('li > button[type="button"]')];
    expect(buttons.map((button) => [button.dataset.id, button.textContent])).toEqual([
      ['000', 'Apertura0:17'],
      ['001', 'Prólogo4:00'],
    ]);
    expect(list.querySelector('a, [download]')).toBeNull();
  });

  it('replaces a previous list instead of appending to it', () => {
    const list = document.createElement('ol');

    renderChapters(list, chapters);
    renderChapters(list, chapters.slice(0, 1));

    expect(list.children).toHaveLength(1);
  });
});

describe('markCurrent', () => {
  it('marks only the chapter being played', () => {
    const list = document.createElement('ol');
    renderChapters(list, chapters);

    markCurrent(list, '001');

    expect([...list.querySelectorAll('button')].map((button) => button.getAttribute('aria-current'))).toEqual([null, 'true']);
  });
});

describe('resumeLabel', () => {
  it('fills the chapter title and the time into the template', () => {
    expect(resumeLabel('Continuar «{title}» en {time}', chapters[1], 93)).toBe('Continuar «Prólogo» en 1:33');
  });
});
