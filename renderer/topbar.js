import { icons } from './icons.js';
import { navigate } from './router.js';
import { openCommandPalette } from './commandPalette.js';

const TABS = [
  { type: 'queue', label: 'Queue', icon: icons.layers },
  { type: 'orders', label: 'Orders', icon: icons.box },
  { type: 'settings', label: 'Settings', icon: icons.settings },
];

const brandEl = document.getElementById('brand');
const tabsEl = document.getElementById('tabs');
const commandTriggerIcon = document.getElementById('command-trigger-icon');
const commandTriggerKbd = document.getElementById('command-trigger-kbd');
const commandTriggerBtn = document.getElementById('command-trigger');

brandEl.innerHTML = `<img src="icon.png" alt="" class="brand-icon" /><span>Print Manager</span>`;
commandTriggerIcon.innerHTML = icons.search;

const isMac = navigator.platform.toLowerCase().includes('mac') || navigator.userAgent.toLowerCase().includes('mac');
commandTriggerKbd.textContent = isMac ? '⌘K' : 'Ctrl K';

tabsEl.innerHTML = TABS.map((tab) => `
  <button class="tab-btn" data-tab="${tab.type}" type="button">${tab.icon}<span>${tab.label}</span></button>
`).join('');

tabsEl.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => navigate({ type: btn.dataset.tab }));
});

commandTriggerBtn.addEventListener('click', () => openCommandPalette());

export function updateActiveTab(navType) {
  const activeType = navType === 'order' ? 'orders' : navType;
  tabsEl.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === activeType);
  });
}
