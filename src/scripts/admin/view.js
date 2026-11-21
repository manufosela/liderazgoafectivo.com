const DATE_FORMAT = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Madrid' });

const cell = (text) => Object.assign(document.createElement('td'), { textContent: text });

const revokeButton = (shortId, label) => {
  const button = Object.assign(document.createElement('button'), { type: 'button', className: 'admin__revoke', textContent: label });
  button.dataset.revoke = shortId;
  button.setAttribute('aria-label', `${label} ${shortId}`);
  return button;
};

/**
 * Table rows of the codes, newest first. A code is never shown here: it only exists when it is created.
 * Every value goes in as text, so a note can never inject markup.
 * @param {HTMLTableSectionElement} body
 * @param {Array<{shortId: string, note: string, createdAt: Date, status: 'active' | 'revoked'}>} grants
 * @param {{statusLabels: Record<'active' | 'revoked', string>, revokeLabel: string}} labels
 */
export const renderGrants = (body, grants, { statusLabels, revokeLabel }) => {
  body.replaceChildren(
    ...grants.toReversed().map(({ shortId, note, createdAt, status }) => {
      const row = document.createElement('tr');
      row.dataset.status = status;
      const actions = document.createElement('td');
      if (status === 'active') actions.append(revokeButton(shortId, revokeLabel));
      row.append(cell(shortId), cell(note), cell(DATE_FORMAT.format(createdAt).replace('.', '')), cell(statusLabels[status]), actions);
      return row;
    }),
  );
};

/** Text ready to paste in an email or a chat to the person who gets the code. */
export const shareMessage = (template, { url, code }) => template.replaceAll('{url}', url).replaceAll('{code}', code);
