/** Keys that move between tabs, as the WAI-ARIA tabs pattern asks: each maps the current index to the next one. */
const MOVES = {
  ArrowRight: (index, count) => (index + 1) % count,
  ArrowLeft: (index, count) => (index - 1 + count) % count,
  Home: () => 0,
  End: (_, count) => count - 1,
};

/**
 * Accessible tabs: one panel shown at a time, opened by click or by the arrow, Home and End keys.
 * Each tab names its panel with aria-controls.
 * @param {HTMLElement} tablist element with role="tablist"
 */
export const startTabs = (tablist) => {
  const tabs = [...tablist.querySelectorAll('[role="tab"]')];
  const panelOf = (tab) => tablist.ownerDocument.getElementById(tab.getAttribute('aria-controls'));

  const open = (chosen) => {
    for (const tab of tabs) {
      const selected = tab === chosen;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      panelOf(tab).hidden = !selected;
    }
  };

  tablist.addEventListener('click', (event) => {
    const tab = event.target.closest('[role="tab"]');
    if (tab) open(tab);
  });
  tablist.addEventListener('keydown', (event) => {
    const move = MOVES[event.key];
    if (!move) return;
    event.preventDefault();
    const next = tabs[move(tabs.indexOf(event.target), tabs.length)];
    open(next);
    next.focus();
  });

  open(tabs[0]);
};
