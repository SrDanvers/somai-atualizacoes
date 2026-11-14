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
  if (!link || !mobileMenu.matches || event.defaultPrevented) return;
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

function setupTabs(tabs, onSelect) {
  function select(selectedTab) {
    for (const tab of tabs) {
      const isSelected = tab === selectedTab;
      tab.setAttribute('aria-selected', String(isSelected));
      tab.tabIndex = isSelected ? 0 : -1;
      document.getElementById(tab.getAttribute('aria-controls')).hidden = !isSelected;
    }
  }

  for (const [index, tab] of tabs.entries()) {
    tab.addEventListener('click', (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      select(tab);
      onSelect?.(tab);
    });

    tab.addEventListener('keydown', (event) => {
      if (event.key === ' ' && tab.matches('a')) {
        event.preventDefault();
        tab.click();
        return;
      }
      const targetIndex = {
        ArrowLeft: (index + tabs.length - 1) % tabs.length,
        ArrowRight: (index + 1) % tabs.length,
        Home: 0,
        End: tabs.length - 1,
      }[event.key];
      if (targetIndex === undefined) return;
      event.preventDefault();
      const target = tabs[targetIndex];
      select(target);
      target.focus({ preventScroll: true });
      onSelect?.(target);
    });
  }
  return select;
}

setupTabs([...document.querySelectorAll('.screen-tabs [role="tab"]')]);

const guide = document.getElementById('instalacao');
const guideTitle = document.getElementById('instalacao-titulo');
const guideTabList = guide.querySelector('.guide-tabs');
const guideTabs = [...guideTabList.querySelectorAll('a')];
const guideTabsByHash = new Map(guideTabs.map(tab => [tab.hash, tab]));

guideTabList.setAttribute('role', 'tablist');
for (const tab of guideTabs) {
  const panel = document.getElementById(tab.hash.slice(1));
  tab.id = `guia-tab-${panel.id}`;
  tab.setAttribute('role', 'tab');
  tab.setAttribute('aria-controls', panel.id);
  panel.setAttribute('role', 'tabpanel');
  panel.setAttribute('aria-labelledby', tab.id);
  panel.tabIndex = 0;
}

const selectGuideTab = setupTabs(guideTabs, (tab) => {
  if (location.hash !== tab.hash) history.pushState(null, '', tab.hash);
  guide.scrollIntoView({ block: 'start' });
});

function updateGuideFromHash(scrollToGuide) {
  const tab = guideTabsByHash.get(location.hash);
  if (tab || location.hash === '#instalacao' || !location.hash) {
    selectGuideTab(tab ?? guideTabs[0]);
  }
  if (tab && scrollToGuide) guide.scrollIntoView({ block: 'start' });
}

updateGuideFromHash(true);
window.addEventListener('hashchange', () => updateGuideFromHash(true));

document.addEventListener('click', (event) => {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = event.target.closest('a[href^="#"]');
  if (!link || (!guideTabsByHash.has(link.hash) && link.hash !== '#instalacao')) return;
  event.preventDefault();
  setMenuOpen(false);
  selectGuideTab(guideTabsByHash.get(link.hash) ?? guideTabs[0]);
  if (location.hash !== link.hash) history.pushState(null, '', link.hash);
  guideTitle.focus({ preventScroll: true });
  guide.scrollIntoView({ block: 'start' });
});

const galleryLinks = [...document.querySelectorAll('.gallery-tile')];
const galleryDialog = document.querySelector('.gallery-dialog');
const galleryImage = galleryDialog.querySelector('.gallery-image');
const galleryTitle = galleryDialog.querySelector('h2');
const galleryPosition = galleryDialog.querySelector('.gallery-position');
let galleryIndex = 0;

function showGalleryImage(index) {
  galleryIndex = (index + galleryLinks.length) % galleryLinks.length;
  const link = galleryLinks[galleryIndex];
  galleryTitle.textContent = link.querySelector('span').textContent;
  galleryImage.alt = link.querySelector('img').alt;
  galleryImage.src = link.href;
  galleryPosition.textContent = `${galleryIndex + 1} de ${galleryLinks.length}`;
}

if (typeof galleryDialog.showModal === 'function') {
  for (const [index, link] of galleryLinks.entries()) {
    link.addEventListener('click', (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      showGalleryImage(index);
      galleryDialog.showModal();
    });
  }
  galleryDialog.querySelector('[data-gallery-previous]').addEventListener('click', () => showGalleryImage(galleryIndex - 1));
  galleryDialog.querySelector('[data-gallery-next]').addEventListener('click', () => showGalleryImage(galleryIndex + 1));
  galleryDialog.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') showGalleryImage(galleryIndex - 1);
    if (event.key === 'ArrowRight') showGalleryImage(galleryIndex + 1);
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
