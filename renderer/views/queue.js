import { icons } from '../icons.js';
import { escapeHtml, formatCurrency, formatMinutes, formatGrams, pluralize } from '../utils.js';
import { plateTableHTML, attachPlateTableHandlers } from '../components/plateTable.js';
import { openNewOrderModal } from '../actions/newOrder.js';
import { navigate } from '../router.js';

export async function renderQueueView(container) {
  const [{ queued, inProgress }, stats, filamentProfiles] = await Promise.all([
    window.api.queue.list(),
    window.api.queue.stats(),
    window.api.filamentProfiles.list(),
  ]);

  container.innerHTML = `
    <div class="view">
      <div class="view-header">
        <div>
          <h1 class="view-title">Print Queue</h1>
          <p class="view-subtitle">What's queued across every order, ready to slice and print.</p>
        </div>
        <div class="view-actions">
          <button class="btn btn-primary" id="new-order-btn" type="button">${icons.plus} New Order</button>
        </div>
      </div>
      <div class="stat-tiles">
        ${statTileHTML(icons.layers, stats.queuedCount, 'Queued')}
        ${statTileHTML(icons.printer, stats.inProgressCount, 'In Progress')}
        ${statTileHTML(icons.check, stats.doneTodayCount, 'Done Today')}
        ${statTileHTML(icons.dollar, formatCurrency(stats.revenueToday), 'Revenue Today')}
      </div>
      <div id="queue-body"></div>
    </div>
  `;

  container.querySelector('#new-order-btn').addEventListener('click', () => {
    openNewOrderModal((order) => navigate({ type: 'order', orderId: order.id }));
  });

  const body = container.querySelector('#queue-body');

  if (queued.length === 0 && inProgress.length === 0) {
    body.innerHTML = `
      <div class="empty-state">
        ${icons.seal}
        <div class="empty-state-title">You're All Caught Up</div>
        <div>Add plates to an order and they'll show up here, ready to send.</div>
      </div>
    `;
    return;
  }

  const upNext = queued[0] || null;
  const rest = queued.slice(1);
  const refresh = () => renderQueueView(container);

  body.innerHTML = `
    ${upNext ? upNextCardHTML(upNext) : ''}
    ${rest.length ? `
      <p class="section-heading">Queued &bull; ${pluralize(rest.length, 'plate')} waiting</p>
      <div id="rest-table">${plateTableHTML(rest, { showContext: true, draggable: true })}</div>
    ` : ''}
    ${inProgress.length ? `
      <p class="section-heading">In Progress</p>
      <div id="progress-table">${plateTableHTML(inProgress, { showContext: true })}</div>
    ` : ''}
  `;

  if (upNext) {
    body.querySelector('#send-up-next').addEventListener('click', () => sendPlate(upNext, refresh));
  }

  attachPlateTableHandlers(body, [...queued, ...inProgress], {
    onChanged: refresh,
    onSend: (plate) => sendPlate(plate, refresh),
    filamentProfiles,
  });

  const restTableEl = body.querySelector('#rest-table table');
  if (restTableEl) setupDragReorder(restTableEl, rest, upNext, refresh);
}

function statTileHTML(icon, value, label) {
  return `
    <div class="stat-tile">
      <div class="stat-icon">${icon}</div>
      <div class="stat-value">${value}</div>
      <div class="stat-label">${label}</div>
    </div>
  `;
}

function upNextCardHTML(plate) {
  const metaParts = [];
  if (plate.filamentProfile) {
    metaParts.push(`<span class="meta-item">${icons.scale}${formatGrams(plate.filamentGrams)}g &bull; ${escapeHtml(plate.filamentProfile.name)}</span>`);
  }
  if (plate.printTimeMinutes > 0) {
    metaParts.push(`<span class="meta-item">${icons.clock}${formatMinutes(plate.printTimeMinutes)}</span>`);
  }

  return `
    <div class="card up-next-card">
      <p class="up-next-eyebrow">UP NEXT</p>
      <div class="up-next-main">
        <div class="up-next-thumb">${plate.thumbnailDataUrl ? `<img src="${plate.thumbnailDataUrl}" alt="" />` : icons.box}</div>
        <div style="flex:1;">
          <p class="up-next-file">${escapeHtml(plate.fileName)}</p>
          ${plate.personName ? `<p class="up-next-context">${escapeHtml(plate.personName)} &bull; ${escapeHtml(plate.orderLabel)}</p>` : ''}
          ${metaParts.length ? `<div class="meta-row">${metaParts.join('')}</div>` : ''}
        </div>
        <div class="up-next-cost">${formatCurrency(plate.cost)}</div>
      </div>
      <button class="btn btn-primary btn-large" id="send-up-next" type="button">${icons.printer} Send to Slicer</button>
    </div>
  `;
}

async function sendPlate(plate, refresh) {
  try {
    await window.api.slicer.send(plate.id);
  } catch (err) {
    alert(`Couldn't open your slicer:\n${err.message}`);
  }
  await refresh();
}

function setupDragReorder(tableEl, restPlates, upNext, refresh) {
  let draggedId = null;

  tableEl.querySelectorAll('tr[data-plate-id]').forEach((row) => {
    row.addEventListener('dragstart', () => {
      draggedId = row.dataset.plateId;
      row.classList.add('dragging');
    });
    row.addEventListener('dragend', () => {
      row.classList.remove('dragging');
      tableEl.querySelectorAll('tr').forEach((r) => r.classList.remove('drop-target'));
    });
    row.addEventListener('dragover', (event) => {
      event.preventDefault();
      if (row.dataset.plateId !== draggedId) row.classList.add('drop-target');
    });
    row.addEventListener('dragleave', () => row.classList.remove('drop-target'));
    row.addEventListener('drop', async (event) => {
      event.preventDefault();
      row.classList.remove('drop-target');
      const targetId = row.dataset.plateId;
      if (!draggedId || draggedId === targetId) return;

      const ids = restPlates.map((p) => p.id);
      const fromIndex = ids.indexOf(draggedId);
      const toIndex = ids.indexOf(targetId);
      if (fromIndex === -1 || toIndex === -1) return;
      ids.splice(toIndex, 0, ids.splice(fromIndex, 1)[0]);

      const orderedIds = upNext ? [upNext.id, ...ids] : ids;
      await window.api.plates.reorder(orderedIds);
      await refresh();
    });
  });
}
