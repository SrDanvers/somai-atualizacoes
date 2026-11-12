import { getPlayStoreUrl } from './downloads.js';

const tabs = [...document.querySelectorAll('.screen-tabs [role="tab"]')];

function showScreen(selectedTab) {
  for (const tab of tabs) {
    const isSelected = tab === selectedTab;
    tab.setAttribute('aria-selected', String(isSelected));
    tab.tabIndex = isSelected ? 0 : -1;
    document.getElementById(tab.getAttribute('aria-controls')).hidden = !isSelected;
  }
}

for (const [index, tab] of tabs.entries()) {
  tab.addEventListener('click', () => showScreen(tab));
  tab.addEventListener('keydown', (event) => {
    const targetIndex = {
      ArrowLeft: (index + tabs.length - 1) % tabs.length,
      ArrowRight: (index + 1) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    }[event.key];
    if (targetIndex === undefined) return;
    event.preventDefault();
    showScreen(tabs[targetIndex]);
    tabs[targetIndex].focus();
  });
}

const storeUrl = getPlayStoreUrl();
if (storeUrl) {
  for (const link of document.querySelectorAll('[data-google-play]')) {
    link.href = storeUrl;
  }
  for (const label of document.querySelectorAll('[data-play-label]')) {
    label.textContent = 'Baixar na Google Play';
  }
  for (const element of document.querySelectorAll('[data-play-pending]')) {
    element.hidden = true;
  }
  for (const element of document.querySelectorAll('[data-play-available]')) {
    element.hidden = false;
  }
}
