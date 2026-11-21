// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { startTabs } from './tabs.js';

let tablist;
const tab = (id) => document.getElementById(`tab-${id}`);
const panel = (id) => document.getElementById(`panel-${id}`);
const press = (key) => document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
const shown = () => ['codes', 'new'].filter((id) => !panel(id).hidden);

beforeEach(() => {
  document.body.innerHTML = `
    <div role="tablist">
      <button role="tab" id="tab-codes" aria-controls="panel-codes">Códigos</button>
      <button role="tab" id="tab-new" aria-controls="panel-new">Nuevo código</button>
    </div>
    <section role="tabpanel" id="panel-codes"></section>
    <section role="tabpanel" id="panel-new"></section>`;
  tablist = document.querySelector('[role="tablist"]');
  startTabs(tablist);
});

describe('startTabs', () => {
  it('opens the first tab and only its panel', () => {
    expect(shown()).toEqual(['codes']);
    expect([tab('codes').getAttribute('aria-selected'), tab('new').getAttribute('aria-selected')]).toEqual(['true', 'false']);
    expect([tab('codes').tabIndex, tab('new').tabIndex]).toEqual([0, -1]);
  });

  it('opens the clicked tab', () => {
    tab('new').click();

    expect(shown()).toEqual(['new']);
    expect(tab('new').getAttribute('aria-selected')).toBe('true');
  });

  it('moves between tabs with the arrow keys, wrapping at both ends', () => {
    tab('codes').focus();

    press('ArrowRight');
    expect([document.activeElement, shown()]).toEqual([tab('new'), ['new']]);
    press('ArrowRight');
    expect(shown()).toEqual(['codes']);
    press('ArrowLeft');
    expect(shown()).toEqual(['new']);
  });

  it('jumps to the first and last tab with Home and End', () => {
    tab('codes').focus();

    press('End');
    expect(shown()).toEqual(['new']);
    press('Home');
    expect(shown()).toEqual(['codes']);
  });

  it('lets other keys through', () => {
    tab('codes').focus();

    press('Enter');

    expect(shown()).toEqual(['codes']);
  });
});
