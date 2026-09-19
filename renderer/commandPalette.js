import { icons } from './icons.js';
import { escapeHtml, formatCurrency } from './utils.js';
import { navigate } from './router.js';
import { openNewOrderModal } from './actions/newOrder.js';

const root = document.getElementById('cmdk-root');
let isOpen = false;

document.addEventListener('keydown', (event) => {
  const isMod = event.metaKey || event.ctrlKey;
  if (isMod && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    if (isOpen) {
      closePalette();
    } else {
      openCommandPalette();
    }
  } else if (isOpen && event.key === 'Escape') {
    closePalette();
  }
});

function closePalette() {
  root.innerHTML = '';
  isOpen = false;
}

export async function openCommandPalette() {
  if (isOpen) return;
  isOpen = true;

  const orders = await window.api.orders.listAll();

  const staticItems = [
    { icon: icons.layers, label: 'Go to Print Queue', run: () => navigate({ type: 'queue' }) },
    { icon: icons.box, label: 'Go to Orders', run: () => navigate({ type: 'orders' }) },
    { icon: icons.settings, label: 'Go to Settings', run: () => navigate({ type: 'settings' }) },
    { icon: icons.plus, label: 'Create New Order', run: () => openNewOrderModal((order) => navigate({ type: 'order', orderId: order.id })) },
  ];

  const orderItems = orders.map((order) => ({
    icon: icons.box,
    label: order.personName || 'Unknown',
    sub: `${order.displayName.replace('Order – ', '')} • ${formatCurrency(order.total)}`,
    run: () => navigate({ type: 'order', orderId: order.id }),
  }));

  root.innerHTML = `
    <div class="cmdk-overlay">
      <div class="cmdk-panel">
        <div class="cmdk-input-row">
          ${icons.search}
          <input type="text" id="cmdk-input" placeholder="Jump to an order, or run a command&hellip;" autocomplete="off" spellcheck="false" />
        </div>
        <div class="cmdk-list" id="cmdk-list"></div>
      </div>
    </div>
  `;

  const overlay = root.querySelector('.cmdk-overlay');
  const input = root.querySelector('#cmdk-input');
  const listEl = root.querySelector('#cmdk-list');

  let allItems = [...staticItems.map((i) => ({ ...i, group: 'Go to' })), ...orderItems.map((i) => ({ ...i, group: 'Orders' }))];
  let filtered = allItems;
  let selectedIndex = 0;

  function renderList() {
    if (filtered.length === 0) {
      listEl.innerHTML = `<div class="cmdk-empty">No matches</div>`;
      return;
    }
    let html = '';
    let lastGroup = null;
    filtered.forEach((item, index) => {
      if (item.group !== lastGroup) {
        html += `<div class="cmdk-group-label">${escapeHtml(item.group)}</div>`;
        lastGroup = item.group;
      }
      html += `
        <div class="cmdk-item ${index === selectedIndex ? 'selected' : ''}" data-index="${index}">
          ${item.icon}<span>${escapeHtml(item.label)}</span>
          ${item.sub ? `<span class="cmdk-item-sub">${escapeHtml(item.sub)}</span>` : ''}
        </div>
      `;
    });
    listEl.innerHTML = html;
    listEl.querySelectorAll('.cmdk-item').forEach((el) => {
      el.addEventListener('mouseenter', () => {
        selectedIndex = Number(el.dataset.index);
        renderList();
      });
      el.addEventListener('click', () => runSelected());
    });
  }

  function runSelected() {
    const item = filtered[selectedIndex];
    if (!item) return;
    closePalette();
    item.run();
  }

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    filtered = q ? allItems.filter((i) => i.label.toLowerCase().includes(q)) : allItems;
    selectedIndex = 0;
    renderList();
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, filtered.length - 1);
      renderList();
      scrollSelectedIntoView();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      renderList();
      scrollSelectedIntoView();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      runSelected();
    } else if (event.key === 'Escape') {
      closePalette();
    }
  });

  function scrollSelectedIntoView() {
    const el = listEl.querySelector('.cmdk-item.selected');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }

  overlay.addEventListener('mousedown', (event) => {
    if (event.target === overlay) closePalette();
  });

  renderList();
  input.focus();
}
