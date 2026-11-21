// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Reads the built page: `npm test` runs `astro build` before vitest.
const html = readFileSync(resolve(import.meta.dirname, '../../../dist/admin/index.html'), 'utf8');
const page = () => new DOMParser().parseFromString(html, 'text/html');

/** What a visitor sees before signing in: the page without the signed-in panel and the revoke dialog. */
const signedOut = () => {
  const doc = page();
  doc.querySelectorAll('[data-panel], dialog, script').forEach((node) => node.remove());
  return doc;
};

describe('/admin page', () => {
  it('shows only a Google sign-in button before signing in', () => {
    const login = signedOut().querySelector('[data-login]');

    expect(login.querySelectorAll('button')).toHaveLength(1);
    expect(login.textContent.trim()).toBe(login.querySelector('[data-sign-in]').textContent.trim());
  });

  it('says nothing about the audiobook before signing in', () => {
    const doc = signedOut();

    expect(`${doc.title} ${doc.body.textContent}`).not.toMatch(/audiolibro/i);
  });

  it('is its own site: no header, menu or footer of the public web', () => {
    const doc = page();
    const outsidePanel = (selector) => [...doc.querySelectorAll(selector)].filter((node) => !node.closest('[data-panel]'));

    expect(outsidePanel('header, nav, footer')).toHaveLength(0);
    expect(doc.querySelector('a[href="/blog"], a[href="/contacto"]')).toBeNull();
  });

  it('offers the sections and the sign-out once signed in', () => {
    const panel = page().querySelector('[data-panel]');

    expect([...panel.querySelectorAll('nav a')].map((link) => link.textContent.trim())).toEqual(['Audiolibro']);
    expect(panel.querySelector('[data-sign-out]')).not.toBeNull();
  });

  it('is never indexed', () => {
    expect(page().querySelector('meta[name="robots"]').getAttribute('content')).toContain('noindex');
  });
});
