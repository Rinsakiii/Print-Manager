import { icons } from '../icons.js';
import { escapeHtml, formatCurrency, pluralize } from '../utils.js';
import { navigate } from '../router.js';
import { openModal } from '../modal.js';
import { plateTableHTML, attachPlateTableHandlers } from '../components/plateTable.js';

const ORDER_STATUSES = ['New', 'In Progress', 'Completed'];

export async function renderOrderView(container, orderId) {
  const [order, plates, filamentProfiles, people] = await Promise.all([
    window.api.orders.get(orderId),
    window.api.plates.listByOrder(orderId),
    window.api.filamentProfiles.list(),
    window.api.people.list(),
  ]);

  if (!order) {
    container.innerHTML = `
      <div class="view"><div class="empty-state">
        <div class="empty-state-title">Order Not Found</div>
      </div></div>
    `;
    return;
  }

  const person = people.find((p) => p.id === order.personId);
  const refresh = () => renderOrderView(container, orderId);

  container.innerHTML = `
    <div class="view">
      <div class="breadcrumbs">
        <button type="button" data-crumb="queue">Home</button>
        <span class="sep">/</span>
        <button type="button" data-crumb="orders">Orders</button>
        <span class="sep">/</span>
        <span class="crumb-current">${escapeHtml(order.personName || 'Order')} — ${escapeHtml(shortDate(order.createdAt))}</span>
      </div>
      <div class="view-header">
        <div>
          <h1 class="view-title">${escapeHtml(order.personName || 'Unnamed Customer')}</h1>
          <p class="view-subtitle">Placed ${escapeHtml(shortDate(order.createdAt))} &bull; ${pluralize(plates.length, 'plate')}</p>
        </div>
        <div class="view-actions">
          <button class="btn btn-danger" id="delete-order-btn" type="button">${icons.trash} Delete Order</button>
          <button class="btn btn-primary" id="add-plate-btn" type="button">${icons.plus} Add Plate</button>
        </div>
      </div>

      <div class="settings-card" id="customer-card">
        <h3>Customer</h3>
        <div class="field-row">
          <div class="field">
            <label for="customer-name">Name</label>
            <input type="text" id="customer-name" value="${escapeHtml(order.personName || '')}" />
          </div>
          <div class="field">
            <label for="customer-contact">Contact info</label>
            <input type="text" id="customer-contact" value="${escapeHtml(order.personContactInfo || '')}" placeholder="email or phone" />
          </div>
        </div>
        ${person && person.orderCount > 1 ? `<button class="btn btn-secondary" id="view-other-orders-btn" type="button">${icons.box} View all ${person.orderCount} orders from ${escapeHtml(person.name)}</button>` : ''}
      </div>

      <div id="plates-body"></div>
      <div class="order-footer">
        <div class="segmented" id="status-segmented">
          ${ORDER_STATUSES.map((s) => `<button data-status="${escapeHtml(s)}" class="${order.status === s ? 'active' : ''}" type="button">${escapeHtml(s)}</button>`).join('')}
        </div>
        <div class="field">
          <label for="order-notes">Notes</label>
          <textarea id="order-notes" placeholder="Optional notes about this order">${escapeHtml(order.notes || '')}</textarea>
        </div>
        <div class="order-total-row">
          <span class="subtotal">Subtotal ${formatCurrency(order.subtotal)}${order.total > order.subtotal ? ' &bull; minimum order price applied' : ''}</span>
          <span class="total">${formatCurrency(order.total)}</span>
        </div>
      </div>
    </div>
  `;

  container.querySelector('[data-crumb="queue"]').addEventListener('click', () => navigate({ type: 'queue' }));
  container.querySelector('[data-crumb="orders"]').addEventListener('click', () => navigate({ type: 'orders' }));

  const otherOrdersBtn = container.querySelector('#view-other-orders-btn');
  if (otherOrdersBtn) {
    otherOrdersBtn.addEventListener('click', () => navigate({ type: 'orders', filterPersonId: order.personId }));
  }

  const titleEl = container.querySelector('.view-title');
  const nameInput = container.querySelector('#customer-name');
  nameInput.addEventListener('input', () => {
    titleEl.textContent = nameInput.value.trim() || 'Unnamed Customer';
  });
  bindCustomerField(nameInput, (value) => {
    window.api.people.update(order.personId, { name: value || order.personName });
  });
  bindCustomerField(container.querySelector('#customer-contact'), (value) => {
    window.api.people.update(order.personId, { contactInfo: value });
  });

  const platesBody = container.querySelector('#plates-body');
  if (plates.length === 0) {
    platesBody.innerHTML = `
      <div class="empty-state">
        ${icons.box}
        <div class="empty-state-title">No Plates Yet</div>
        <div>Import a .3mf file to add the first plate.</div>
      </div>
    `;
  } else {
    platesBody.innerHTML = plateTableHTML(plates, { showContext: false });
    attachPlateTableHandlers(platesBody, plates, {
      onChanged: refresh,
      onSend: (plate) => sendPlate(plate, refresh),
      filamentProfiles,
    });
  }

  container.querySelector('#add-plate-btn').addEventListener('click', () => {
    openAddPlateModal(orderId, filamentProfiles, refresh);
  });

  container.querySelector('#delete-order-btn').addEventListener('click', async () => {
    if (!confirm("Delete this order and all of its plates? This can't be undone.")) return;
    await window.api.orders.delete(orderId);
    navigate({ type: 'orders' });
  });

  container.querySelectorAll('#status-segmented button').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await window.api.orders.update(orderId, { status: btn.dataset.status });
      await refresh();
    });
  });

  const notesEl = container.querySelector('#order-notes');
  let notesTimer = null;
  notesEl.addEventListener('input', () => {
    clearTimeout(notesTimer);
    notesTimer = setTimeout(() => {
      window.api.orders.update(orderId, { notes: notesEl.value });
    }, 500);
  });
}

function bindCustomerField(input, onSave) {
  let timer = null;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => onSave(input.value.trim()), 500);
  });
}

function shortDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

async function sendPlate(plate, refresh) {
  try {
    await window.api.slicer.send(plate.id);
  } catch (err) {
    alert(`Couldn't open your slicer:\n${err.message}`);
  }
  await refresh();
}

function openAddPlateModal(orderId, filamentProfiles, onDone) {
  let selectedFilePath = null;

  const profileOptions = filamentProfiles
    .map((p) => `<option value="${p.id}">${escapeHtml(p.name)} (${formatCurrency(p.costPerGram)}/g)</option>`)
    .join('');

  openModal({
    title: 'Add Plate',
    width: 460,
    bodyHtml: `
      <div class="field">
        <label>File</label>
        <div class="file-preview-row">
          <div class="file-preview-thumb" id="file-preview-thumb">${icons.box}</div>
          <button class="btn btn-secondary" id="pick-file-btn" type="button" style="flex:1; justify-content:flex-start;">
            ${icons.folder} <span id="picked-file-label">Choose a .3mf file&hellip;</span>
          </button>
        </div>
        <p class="field-hint" id="autofill-hint" style="display:none;">Grams/time filled in from the file's slice data &mdash; feel free to adjust.</p>
      </div>
      <div class="field-row">
        <div class="field">
          <label for="plate-profile">Filament profile</label>
          <select id="plate-profile">
            <option value="">None</option>
            ${profileOptions}
          </select>
        </div>
        <div class="field">
          <label for="plate-grams">Grams used</label>
          <input type="number" id="plate-grams" min="0" step="0.1" value="0" />
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label for="plate-hours">Print time &mdash; hours</label>
          <input type="number" id="plate-hours" min="0" step="1" value="0" />
        </div>
        <div class="field">
          <label for="plate-minutes">Print time &mdash; minutes</label>
          <input type="number" id="plate-minutes" min="0" max="59" step="5" value="0" />
        </div>
      </div>
      <div class="toggle-row">
        <label for="plate-override">Override calculated cost</label>
        <input type="checkbox" id="plate-override" style="width:auto;" />
      </div>
      <div class="field" id="manual-cost-field" style="display:none;">
        <label for="plate-manual-cost">Manual cost</label>
        <input type="number" id="plate-manual-cost" min="0" step="0.01" value="0" />
      </div>
      <div class="calc-preview" id="calc-preview">
        <span>Calculated cost</span>
        <strong id="calc-preview-value">${formatCurrency(0)}</strong>
      </div>
      <div class="field">
        <label for="plate-notes">Notes (optional)</label>
        <textarea id="plate-notes" placeholder="Optional notes"></textarea>
      </div>
      <p class="error-text" id="plate-error" style="display:none;"></p>
      <div class="form-actions">
        <button class="btn btn-secondary" id="cancel-btn" type="button">Cancel</button>
        <button class="btn btn-primary" id="save-btn" type="button" disabled>Add Plate</button>
      </div>
    `,
    onMount: async (el, closeFn) => {
      const pickBtn = el.querySelector('#pick-file-btn');
      const pickedLabel = el.querySelector('#picked-file-label');
      const thumbEl = el.querySelector('#file-preview-thumb');
      const saveBtn = el.querySelector('#save-btn');
      const profileSelect = el.querySelector('#plate-profile');
      const gramsInput = el.querySelector('#plate-grams');
      const hoursInput = el.querySelector('#plate-hours');
      const minutesInput = el.querySelector('#plate-minutes');
      const overrideCheckbox = el.querySelector('#plate-override');
      const manualCostField = el.querySelector('#manual-cost-field');
      const manualCostInput = el.querySelector('#plate-manual-cost');
      const calcPreview = el.querySelector('#calc-preview');
      const calcPreviewValue = el.querySelector('#calc-preview-value');
      const notesInput = el.querySelector('#plate-notes');
      const errorEl = el.querySelector('#plate-error');

      const settings = await window.api.settings.get();

      function updatePreview() {
        const profile = filamentProfiles.find((p) => p.id === profileSelect.value);
        const grams = parseFloat(gramsInput.value) || 0;
        const hours = parseFloat(hoursInput.value) || 0;
        const minutes = parseFloat(minutesInput.value) || 0;
        const material = grams * (profile ? profile.costPerGram : 0);
        const time = (hours + minutes / 60) * (settings.hourlyRate || 0);
        calcPreviewValue.textContent = formatCurrency(material + time);
      }
      [profileSelect, gramsInput, hoursInput, minutesInput].forEach((input) => {
        input.addEventListener('input', updatePreview);
      });
      updatePreview();

      overrideCheckbox.addEventListener('change', () => {
        manualCostField.style.display = overrideCheckbox.checked ? 'block' : 'none';
        calcPreview.style.display = overrideCheckbox.checked ? 'none' : 'flex';
      });

      const autofillHint = el.querySelector('#autofill-hint');

      pickBtn.addEventListener('click', async () => {
        const filePath = await window.api.plates.pickFile();
        if (!filePath) return;
        selectedFilePath = filePath;
        pickedLabel.textContent = filePath.split(/[\\/]/).pop();
        saveBtn.disabled = false;
        thumbEl.innerHTML = icons.box;
        autofillHint.style.display = 'none';

        const preview = await window.api.plates.previewFile(filePath);
        if (preview.thumbnailDataUrl) {
          thumbEl.innerHTML = `<img src="${preview.thumbnailDataUrl}" alt="" />`;
        }

        let filledSomething = false;
        if (preview.filamentGrams != null && (gramsInput.value === '' || parseFloat(gramsInput.value) === 0)) {
          gramsInput.value = preview.filamentGrams;
          filledSomething = true;
        }
        if (preview.printTimeMinutes != null && (parseFloat(hoursInput.value) || 0) === 0 && (parseFloat(minutesInput.value) || 0) === 0) {
          hoursInput.value = Math.floor(preview.printTimeMinutes / 60);
          minutesInput.value = preview.printTimeMinutes % 60;
          filledSomething = true;
        }
        updatePreview();
        if (filledSomething) {
          autofillHint.textContent = "Grams/time filled in from the file's slice data — feel free to adjust.";
          autofillHint.classList.remove('warn');
          autofillHint.style.display = 'block';
        } else if (preview.printTimeMinutes == null && preview.filamentGrams == null) {
          autofillHint.textContent = "This file has no slice data to read — that's only embedded by Bambu Studio/OrcaSlicer, and only after a plate's been sliced. Enter grams and print time manually, or pick a filament profile, so this plate isn't priced at $0.";
          autofillHint.classList.add('warn');
          autofillHint.style.display = 'block';
        }
      });

      el.querySelector('#cancel-btn').addEventListener('click', closeFn);

      saveBtn.addEventListener('click', async () => {
        if (!selectedFilePath) return;
        saveBtn.disabled = true;
        errorEl.style.display = 'none';
        try {
          await window.api.plates.create({
            orderId,
            sourceFilePath: selectedFilePath,
            filamentProfileId: profileSelect.value || null,
            filamentGrams: parseFloat(gramsInput.value) || 0,
            printTimeMinutes: (parseFloat(hoursInput.value) || 0) * 60 + (parseFloat(minutesInput.value) || 0),
            manualCostOverride: overrideCheckbox.checked ? (parseFloat(manualCostInput.value) || 0) : null,
            notes: notesInput.value.trim(),
          });
          closeFn();
          await onDone();
        } catch (err) {
          errorEl.textContent = err.message;
          errorEl.style.display = 'block';
          saveBtn.disabled = false;
        }
      });
    },
  });
}
