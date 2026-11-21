// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

// Reads the built page and its stylesheets: `npm test` runs `astro build` before vitest.
const dist = (path) => readFileSync(resolve(import.meta.dirname, '../../../dist', path), 'utf8');

beforeAll(() => {
  const built = new DOMParser().parseFromString(dist('audiolibro/index.html'), 'text/html');
  const linked = [...built.querySelectorAll('link[rel="stylesheet"][href^="/_astro/"]')].map((link) => dist(link.getAttribute('href').slice(1)));
  const styles = [...linked, ...[...built.querySelectorAll('style')].map((style) => style.textContent)];
  document.body.innerHTML = built.body.innerHTML;
  styles.forEach((css) => document.head.append(Object.assign(document.createElement('style'), { textContent: css })));
});

/** Rules that would show the element: any author display beats the browser's own [hidden] rule. */
const rulesShowing = (element) =>
  [...document.styleSheets]
    .flatMap((sheet) => [...sheet.cssRules])
    .filter((rule) => rule.selectorText && rule.style.display && rule.style.display !== 'none' && element.matches(rule.selectorText))
    .map((rule) => rule.selectorText);

describe('/audiolibro page', () => {
  it.each(['#audiobook-access', '#audiobook-player'])('really hides %s when the script hides it', (selector) => {
    const section = document.querySelector(selector);

    section.hidden = true;

    expect(rulesShowing(section)).toEqual([]);
  });
});
