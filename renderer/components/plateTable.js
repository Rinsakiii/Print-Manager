import { icons } from '../icons.js';
import { escapeHtml, formatCurrency, formatMinutes, formatGrams } from '../utils.js';
import { openEditPlateModal } from '../actions/editPlate.js';

const STATUS_BADGE_CLASS = {
  Queued: 'badge-secondary',
  'Sent to Slicer': 'badge-info',
  Done: 'badge-success',
  Failed: 'badge-danger',
};

export function plateTableHTML(plates, { showContext = false, draggable = false } = {}) {
  const headCells = [];
  if (draggable) headCells.push('<th class="col-tight"></th>');
  headCells.push('<th>File</th>');
  if (showContext) headCells.push('<th>Client / Order</th>');
  headCells.push('<th>Filament</th>');
  headCells.push('<th>Time</th>');
  headCells.push('<th style="text-align:right;">Cost</th>');
  headCells.push('<th>Status</th>');
  headCells.push('<th class="col-tight"></th>');

  return `
    <div class="data-table-wrap">
      <table class="data-table">
        <thead><tr>${headCells.join('')}</tr></thead>
        <tbody>${plates.map((p) => plateRowHTML(p, { showContext, draggable })).join('')}</tbody>
      </table>
    </div>
  `;
}

function plateRowHTML(plate, { showContext, draggable }) {
  const badgeClass = STATUS_BADGE_CLASS[plate.status] || 'badge-secondary';

  const cells = [];
  if (draggable) {
    cells.push(`<td class="col-tight"><span class="drag-handle">${icons.grip}</span></td>`);
  }
  cells.push(`
    <td>
      <div class="cell-primary">
        <span class="plate-thumb">${plate.thumbnailDataUrl ? `<img src="${plate.thumbnailDataUrl}" alt="" />` : icons.box}</span>
        <span class="cell-title">${escapeHtml(plate.fileName)}</span>
      </div>
    </td>
  `);
  if (showContext) {
    cells.push(`
      <td>
        ${plate.personName ? `${escapeHtml(plate.personName)}<div class="cell-sub">${escapeHtml(plate.orderLabel)}</div>` : '&mdash;'}
      </td>
    `);
  }
  cells.push(`<td>${plate.filamentProfile ? `${formatGrams(plate.filamentGrams)}g ${escapeHtml(plate.filamentProfile.name)}` : '&mdash;'}</td>`);
  cells.push(`<td>${plate.printTimeMinutes > 0 ? formatMinutes(plate.printTimeMinutes) : '&mdash;'}</td>`);
  cells.push(`<td class="col-cost">${formatCurrency(plate.cost)}</td>`);
  cells.push(`<td><span class="badge ${badgeClass}">${escapeHtml(plate.status)}</span></td>`);
  cells.push(`
    <td class="col-tight">
      <div class="row-menu">
        <button class="icon-btn plate-menu-btn" type="button" aria-label="Plate actions">${icons.ellipsis}</button>
      </div>
    </td>
  `);

  return `<tr data-plate-id="${plate.id}" ${draggable ? 'draggable="true"' : ''}>${cells.join('')}</tr>`;
}

let openForButton = null;

function closeAllMenus() {
  document.querySelectorAll('.menu-popover').forEach((el) => el.remove());
  openForButton = null;
}

document.addEventListener('click', closeAllMenus);
document.getElementById('view-root')?.addEventListener('scroll', closeAllMenus, { passive: true });

export function attachPlateTableHandlers(container, plates, { onChanged, onSend, filamentProfiles = [] }) {
  container.querySelectorAll('tr[data-plate-id]').forEach((rowEl) => {
    const plateId = rowEl.dataset.plateId;
    const plate = plates.find((p) => p.id === plateId);
    if (!plate) return;

    const menuBtn = rowEl.querySelector('.plate-menu-btn');
    menuBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      const wasOpenForThisButton = openForButton === menuBtn;
      closeAllMenus();
      if (!wasOpenForThisButton) openMenuFor(menuBtn, plate, { onChanged, onSend, filamentProfiles });
    });
  });
}

// Menus render into document.body (position: fixed, coordinates taken from the
// trigger button) instead of nesting inside the row — the table's rounded
// corners rely on overflow:hidden on .data-table-wrap, which would otherwise
// clip any dropdown that extends past the table's edges.
function openMenuFor(menuBtn, plate, { onChanged, onSend, filamentProfiles }) {
  openForButton = menuBtn;
  const popover = document.createElement('div');
  popover.className = 'menu-popover';
  popover.innerHTML = `
    <button class="menu-item" data-action="edit" type="button">${icons.pencil} Edit Details</button>
    <button class="menu-item" data-action="send" type="button">${icons.printer} Send to Slicer</button>
    <button class="menu-item" data-action="reveal" type="button">${icons.folder} Reveal File</button>
    <div class="menu-divider"></div>
    <button class="menu-item" data-action="done" type="button">${icons.check} Mark Done</button>
    <button class="menu-item" data-action="failed" type="button">${icons.x} Mark Failed</button>
    <button class="menu-item" data-action="requeue" type="button">${icons.layers} Reset to Queued</button>
    <div class="menu-divider"></div>
    <button class="menu-item danger" data-action="delete" type="button">${icons.trash} Delete Plate</button>
  `;
  popover.addEventListener('mousedown', (event) => event.stopPropagation());
  document.body.appendChild(popover);
  positionPopover(popover, menuBtn);

  const actions = {
    edit: async () => openEditPlateModal(plate, filamentProfiles, onChanged),
    send: async () => onSend && onSend(plate),
    reveal: async () => window.api.plates.reveal(plate.storedFileName),
    done: async () => window.api.plates.update(plate.id, { status: 'Done' }),
    failed: async () => window.api.plates.update(plate.id, { status: 'Failed' }),
    requeue: async () => window.api.plates.update(plate.id, { status: 'Queued', sentAt: null }),
    delete: async () => window.api.plates.delete(plate.id),
  };

  Object.entries(actions).forEach(([action, handler]) => {
    popover.querySelector(`[data-action="${action}"]`).addEventListener('click', async () => {
      closeAllMenus();
      await handler();
      // "send" and "edit" manage their own refresh (edit's modal calls onChanged itself after saving).
      if (action !== 'send' && action !== 'edit' && onChanged) await onChanged();
    });
  });
}

function positionPopover(popover, anchorEl) {
  const anchorRect = anchorEl.getBoundingClientRect();
  const popoverRect = popover.getBoundingClientRect();
  const margin = 8;

  let left = anchorRect.right - popoverRect.width;
  left = Math.max(margin, Math.min(left, window.innerWidth - popoverRect.width - margin));

  let top = anchorRect.bottom + 4;
  if (top + popoverRect.height > window.innerHeight - margin) {
    top = anchorRect.top - popoverRect.height - 4;
  }

  popover.style.position = 'fixed';
  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
  popover.style.right = 'auto';
}
