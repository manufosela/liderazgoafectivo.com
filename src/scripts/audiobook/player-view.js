import { formatDuration } from './player-model.js';

/** Chapter list as plain buttons: playable by keyboard, with no link to any audio file. */
export const renderChapters = (list, chapters) => {
  list.replaceChildren(
    ...chapters.map(({ id, title, duration }) => {
      const item = document.createElement('li');
      const button = Object.assign(document.createElement('button'), { type: 'button', className: 'audiobook__chapter' });
      button.dataset.id = id;
      button.append(title, Object.assign(document.createElement('span'), { className: 'audiobook__duration', textContent: formatDuration(duration) }));
      item.append(button);
      return item;
    }),
  );
};

export const markCurrent = (list, id) => {
  for (const button of list.querySelectorAll('button[data-id]')) {
    if (button.dataset.id === id) button.setAttribute('aria-current', 'true');
    else button.removeAttribute('aria-current');
  }
};

export const resumeLabel = (template, chapter, position) =>
  template.replace('{title}', chapter.title).replace('{time}', formatDuration(position));
