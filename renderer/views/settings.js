import { icons } from '../icons.js';
import { escapeHtml, setCurrency } from '../utils.js';
import { renderSlicerPicker } from '../components/slicerPicker.js';

export async function renderSettingsView(container) {
  const [settings, filamentProfiles] = await Promise.all([
    window.api.settings.get(),
    window.api.filamentProfiles.list(),
  ]);

  container.innerHTML = `
    <div class="view">
      <div class="view-header">
        <div>
          <h1 class="view-title">Settings</h1>
          <p class="view-subtitle">Pricing defaults and filament profiles used across every order.</p>
        </div>
      </div>
      <div class="view-body">
        <div class="settings-card">
          <h3>Pricing</h3>
          <p class="hint">These drive every plate's calculated cost and each order's running total.</p>
          <div class="field-row">
            <div class="field">
              <label for="hourly-rate">Hourly rate</label>
              <input type="number" id="hourly-rate" min="0" step="0.01" value="${settings.hourlyRate}" />
              <p class="field-hint">Charged per hour of print time &mdash; covers electricity and machine wear.</p>
            </div>
            <div class="field">
              <label for="min-order">Minimum order price</label>
              <input type="number" id="min-order" min="0" step="0.01" value="${settings.minimumOrderPrice}" />
              <p class="field-hint">Every non-empty order is charged at least this much.</p>
            </div>
          </div>
          <div class="field" style="max-width:160px;">
            <label for="currency">Currency code</label>
            <input type="text" id="currency" maxlength="3" value="${escapeHtml(settings.currency || 'USD')}" style="text-transform:uppercase;" />
          </div>
        </div>

        <div class="settings-card">
          <h3>Filament Profiles</h3>
          <p class="hint">Cost per gram for each material you stock. Pick one when adding a plate.</p>
          <div id="profiles-list"></div>
          <button class="btn btn-secondary" id="add-profile-btn" type="button" style="margin-top:10px;">${icons.plus} Add Filament Profile</button>
        </div>

        <div class="settings-card">
          <h3>Slicer</h3>
          <p class="hint">Which app opens when you send a plate to print. Works with any slicer &mdash; Bambu Studio, OrcaSlicer, PrusaSlicer, Cura, or whatever else you use.</p>
          <div class="slicer-picker" id="settings-slicer-picker"></div>
        </div>
      </div>
    </div>
  `;

  const refresh = () => renderSettingsView(container);

  bindNumberSetting(container, '#hourly-rate', 'hourlyRate');
  bindNumberSetting(container, '#min-order', 'minimumOrderPrice');

  const currencyInput = container.querySelector('#currency');
  currencyInput.addEventListener('change', async () => {
    const code = currencyInput.value.trim().toUpperCase() || 'USD';
    currencyInput.value = code;
    await window.api.settings.update({ currency: code });
    setCurrency(code);
    await refresh();
  });

  const slicerPickerEl = container.querySelector('#settings-slicer-picker');
  async function refreshSlicerPicker(currentPath, currentName) {
    await renderSlicerPicker(slicerPickerEl, {
      currentPath,
      currentName,
      onSelect: async (sel) => {
        await window.api.settings.update({ slicerPath: sel.slicerPath, slicerName: sel.slicerName });
        await refreshSlicerPicker(sel.slicerPath, sel.slicerName);
      },
    });
  }
  await refreshSlicerPicker(settings.slicerPath, settings.slicerName);

  renderProfilesList(container.querySelector('#profiles-list'), filamentProfiles, refresh);

  container.querySelector('#add-profile-btn').addEventListener('click', async () => {
    await window.api.filamentProfiles.create({ name: 'New Filament', costPerGram: 0.02 });
    await refresh();
  });
}

function bindNumberSetting(container, selector, key) {
  const input = container.querySelector(selector);
  let timer = null;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const value = Math.max(0, parseFloat(input.value) || 0);
      await window.api.settings.update({ [key]: value });
    }, 400);
  });
}

function renderProfilesList(listEl, profiles, refresh) {
  if (profiles.length === 0) {
    listEl.innerHTML = `<p class="field-hint">No filament profiles yet.</p>`;
    return;
  }
  listEl.innerHTML = profiles.map((profile) => `
    <div class="profile-row" data-profile-id="${profile.id}">
      <input type="text" class="profile-name" value="${escapeHtml(profile.name)}" />
      <input type="number" class="profile-cost" min="0" step="0.001" value="${profile.costPerGram}" style="width:100px;" />
      <span class="grams-suffix">/g</span>
      <button class="icon-btn profile-delete" type="button" aria-label="Delete profile">${icons.trash}</button>
    </div>
  `).join('');

  listEl.querySelectorAll('.profile-row').forEach((row) => {
    const id = row.dataset.profileId;
    const nameInput = row.querySelector('.profile-name');
    const costInput = row.querySelector('.profile-cost');
    let timer = null;
    const save = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        window.api.filamentProfiles.update(id, {
          name: nameInput.value.trim() || 'Untitled',
          costPerGram: Math.max(0, parseFloat(costInput.value) || 0),
        });
      }, 400);
    };
    nameInput.addEventListener('input', save);
    costInput.addEventListener('input', save);
    row.querySelector('.profile-delete').addEventListener('click', async () => {
      await window.api.filamentProfiles.delete(id);
      await refresh();
    });
  });
}
