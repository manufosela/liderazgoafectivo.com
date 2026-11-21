// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { renderGrants, shareMessage } from './view.js';

const labels = { statusLabels: { active: 'Activo', revoked: 'Revocado' }, revokeLabel: 'Revocar', unknownEmail: 'Desconocido' };
const grants = [
  { shortId: 'aaaa1111', email: null, note: 'Primero', createdAt: new Date('2026-11-20T10:00:00Z'), status: 'revoked' },
  { shortId: 'bbbb2222', email: 'lectora@example.com', note: '<img src=x onerror=alert(1)>', createdAt: new Date('2026-11-21T10:00:00Z'), status: 'active' },
];

describe('renderGrants', () => {
  it('shows the newest code first with short id, email, note, date and status', () => {
    const body = document.createElement('tbody');

    renderGrants(body, grants, labels);

    const rows = [...body.querySelectorAll('tr')].map((row) => [...row.querySelectorAll('td')].slice(0, 5).map((cell) => cell.textContent));
    expect(rows).toEqual([
      ['bbbb2222', 'lectora@example.com', '<img src=x onerror=alert(1)>', '21 nov 2026', 'Activo'],
      ['aaaa1111', 'Desconocido', 'Primero', '20 nov 2026', 'Revocado'],
    ]);
    expect(body.querySelector('img')).toBeNull();
  });

  it('offers to revoke only the active codes', () => {
    const body = document.createElement('tbody');

    renderGrants(body, grants, labels);

    const buttons = [...body.querySelectorAll('button[data-revoke]')];
    expect(buttons.map((button) => [button.dataset.revoke, button.type, button.textContent, button.getAttribute('aria-label')])).toEqual([
      ['bbbb2222', 'button', 'Revocar', 'Revocar bbbb2222'],
    ]);
  });

  it('replaces the previous rows', () => {
    const body = document.createElement('tbody');

    renderGrants(body, grants, labels);
    renderGrants(body, grants.slice(0, 1), labels);

    expect(body.querySelectorAll('tr')).toHaveLength(1);
  });
});

describe('shareMessage', () => {
  it('fills the link and the code into the template', () => {
    expect(shareMessage('Entra en {url} con el código {code}. Código: {code}', { url: 'https://liderazgoafectivo.com/audiolibro', code: 'AAAA-BBBB-CCCC' })).toBe(
      'Entra en https://liderazgoafectivo.com/audiolibro con el código AAAA-BBBB-CCCC. Código: AAAA-BBBB-CCCC',
    );
  });
});
