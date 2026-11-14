import { getPlayStoreUrl } from './downloads.js';

const menuToggle = document.querySelector('.menu-toggle');
const siteNav = menuToggle.closest('.site-nav');
const menu = document.getElementById(menuToggle.getAttribute('aria-controls'));
const mobileMenu = matchMedia('(max-width: 900px)');

function setMenuOpen(open) {
  menuToggle.setAttribute('aria-expanded', String(open));
}

siteNav.classList.add('is-menu-enhanced');
menuToggle.hidden = false;
menuToggle.addEventListener('click', () => {
  setMenuOpen(menuToggle.getAttribute('aria-expanded') === 'false');
});

siteNav.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || menuToggle.getAttribute('aria-expanded') !== 'true') return;
  setMenuOpen(false);
  menuToggle.focus();
});

menu.addEventListener('click', (event) => {
  const link = event.target.closest('a');
  if (!link || !mobileMenu.matches) return;
  setMenuOpen(false);
  const section = document.getElementById(link.hash.slice(1));
  section.tabIndex = -1;
  section.focus({ preventScroll: true });
});

document.addEventListener('click', (event) => {
  if (!siteNav.contains(event.target)) setMenuOpen(false);
});

mobileMenu.addEventListener('change', () => {
  setMenuOpen(false);
  if (mobileMenu.matches && menu.contains(document.activeElement)) menuToggle.focus();
});

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
