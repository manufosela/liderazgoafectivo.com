// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

// Reads the built page and its stylesheets: `npm test` runs `astro build` before vitest.
const dist = (path) => readFileSync(resolve(import.meta.dirname, '../../../dist', path), 'utf8');

let built;

beforeAll(() => {
  built = new DOMParser().parseFromString(dist('audiolibro/index.html'), 'text/html');
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

describe('/audiolibro content security policy', () => {
  const AUDIO_API = 'https://europe-west1-comunidad-liderazgoafectivo.cloudfunctions.net';
  const policy = () => {
    const meta = built.querySelector('meta[http-equiv="Content-Security-Policy"]');
    return Object.fromEntries(
      meta
        .getAttribute('content')
        .split(';')
        .map((directive) => directive.trim().split(/\s+/))
        .filter(([name]) => name)
        .map(([name, ...sources]) => [name, sources]),
    );
  };

  it('runs only the site own scripts, and the page has no inline script to run', () => {
    expect(policy()['script-src']).toEqual(["'self'"]);
    const inline = [...built.querySelectorAll('script:not([src])')].filter((script) => script.type !== 'application/ld+json');
    expect(inline).toHaveLength(0);
  });

  it('sends data only to the site and the audiobook service', () => {
    expect(policy()['connect-src']).toEqual(["'self'", AUDIO_API]);
    expect(policy()['img-src']).toEqual(["'self'", 'data:']);
    expect([policy()['form-action'], policy()['object-src'], policy()['base-uri']]).toEqual([["'self'"], ["'none'"], ["'self'"]]);
  });

  it('comes before anything the page loads, so it governs all of it', () => {
    const first = built.head.querySelector('meta[http-equiv="Content-Security-Policy"], script, link, style');

    expect(first.getAttribute('http-equiv')).toBe('Content-Security-Policy');
  });
});
