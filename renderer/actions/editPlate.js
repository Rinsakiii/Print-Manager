import { openModal } from '../modal.js';
import { escapeHtml, formatCurrency } from '../utils.js';

export function openEditPlateModal(plate, filamentProfiles, onSaved) {
  const profileOptions = filamentProfiles
    .map((p) => `<option value="${p.id}" ${p.id === plate.filamentProfileId ? 'selected' : ''}>${escapeHtml(p.name)} (${formatCurrency(p.costPerGram)}/g)</option>`)
    .join('');

  const initialHours = Math.floor((plate.printTimeMinutes || 0) / 60);
  const initialMinutes = (plate.printTimeMinutes || 0) % 60;
  const hasOverride = plate.manualCostOverride != null;

  openModal({
    title: 'Edit Plate',
    width: 460,
    bodyHtml: `
      <p class="field-hint" style="margin-bottom:14px;">${escapeHtml(plate.fileName)}</p>
      <div class="field-row">
        <div class="field">
          <label for="edit-plate-profile">Filament profile</label>
          <select id="edit-plate-profile">
            <option value="">None</option>
            ${profileOptions}
          </select>
        </div>
        <div class="field">
          <label for="edit-plate-grams">Grams used</label>
          <input type="number" id="edit-plate-grams" min="0" step="0.1" value="${plate.filamentGrams || 0}" />
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label for="edit-plate-hours">Print time &mdash; hours</label>
          <input type="number" id="edit-plate-hours" min="0" step="1" value="${initialHours}" />
        </div>
        <div class="field">
          <label for="edit-plate-minutes">Print time &mdash; minutes</label>
          <input type="number" id="edit-plate-minutes" min="0" max="59" step="5" value="${initialMinutes}" />
        </div>
      </div>
      <div class="toggle-row">
        <label for="edit-plate-override">Override calculated cost</label>
        <input type="checkbox" id="edit-plate-override" style="width:auto;" ${hasOverride ? 'checked' : ''} />
      </div>
      <div class="field" id="edit-manual-cost-field" style="display:${hasOverride ? 'block' : 'none'};">
        <label for="edit-plate-manual-cost">Manual cost</label>
        <input type="number" id="edit-plate-manual-cost" min="0" step="0.01" value="${plate.manualCostOverride || 0}" />
      </div>
      <div class="calc-preview" id="edit-calc-preview" style="display:${hasOverride ? 'none' : 'flex'};">
        <span>Calculated cost</span>
        <strong id="edit-calc-preview-value">${formatCurrency(0)}</strong>
      </div>
      <div class="field">
        <label for="edit-plate-notes">Notes (optional)</label>
        <textarea id="edit-plate-notes" placeholder="Optional notes">${escapeHtml(plate.notes || '')}</textarea>
      </div>
      <div class="form-actions">
        <button class="btn btn-secondary" id="edit-cancel-btn" type="button">Cancel</button>
        <button class="btn btn-primary" id="edit-save-btn" type="button">Save Changes</button>
      </div>
    `,
    onMount: async (el, closeFn) => {
      const profileSelect = el.querySelector('#edit-plate-profile');
      const gramsInput = el.querySelector('#edit-plate-grams');
      const hoursInput = el.querySelector('#edit-plate-hours');
      const minutesInput = el.querySelector('#edit-plate-minutes');
      const overrideCheckbox = el.querySelector('#edit-plate-override');
      const manualCostField = el.querySelector('#edit-manual-cost-field');
      const manualCostInput = el.querySelector('#edit-plate-manual-cost');
      const calcPreview = el.querySelector('#edit-calc-preview');
      const calcPreviewValue = el.querySelector('#edit-calc-preview-value');
      const notesInput = el.querySelector('#edit-plate-notes');

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

      el.querySelector('#edit-cancel-btn').addEventListener('click', closeFn);
      el.querySelector('#edit-save-btn').addEventListener('click', async () => {
        await window.api.plates.update(plate.id, {
          filamentProfileId: profileSelect.value || null,
          filamentGrams: parseFloat(gramsInput.value) || 0,
          printTimeMinutes: (parseFloat(hoursInput.value) || 0) * 60 + (parseFloat(minutesInput.value) || 0),
          manualCostOverride: overrideCheckbox.checked ? (parseFloat(manualCostInput.value) || 0) : null,
          notes: notesInput.value.trim(),
        });
        closeFn();
        if (onSaved) await onSaved();
      });
    },
  });
}
