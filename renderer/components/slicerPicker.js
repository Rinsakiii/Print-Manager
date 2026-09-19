import { icons } from '../icons.js';
import { escapeHtml } from '../utils.js';

/**
 * Renders a list of selectable slicer options — auto-detected installs,
 * "System Default", and (if already chosen) a custom browsed path — plus a
 * "Browse for another app..." action. Calls onSelect({ slicerPath, slicerName })
 * whenever the user picks something; the caller owns persisting it and
 * re-rendering with the new current values.
 */
export async function renderSlicerPicker(container, { currentPath, currentName, onSelect }) {
  container.innerHTML = `<p class="field-hint">Looking for installed slicers&hellip;</p>`;
  const detected = await window.api.slicers.detect();

  const isSystemDefault = !currentPath;
  const isCustomSelected = !!currentPath && !detected.some((d) => d.path === currentPath);

  const rows = [];
  rows.push(optionHTML({
    id: 'system-default',
    name: 'System Default',
    sub: "Whatever app your OS already opens .3mf files with",
    selected: isSystemDefault,
  }));
  detected.forEach((d) => {
    rows.push(optionHTML({ id: d.id, name: d.name, sub: d.path, selected: currentPath === d.path }));
  });
  if (isCustomSelected) {
    rows.push(optionHTML({ id: 'custom-current', name: currentName || 'Custom App', sub: currentPath, selected: true }));
  }

  container.innerHTML = `
    <div class="slicer-picker-list">${rows.join('')}</div>
    <button class="slicer-option slicer-option-browse" id="browse-slicer-option" type="button">
      ${icons.folder}
      <div class="slicer-option-text"><div class="slicer-option-name">Browse for another app&hellip;</div></div>
    </button>
  `;

  container.querySelectorAll('.slicer-option[data-slicer-id]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.dataset.slicerId;
      if (id === 'system-default') {
        onSelect({ slicerPath: null, slicerName: null });
      } else if (id === 'custom-current') {
        // Already the current selection — nothing to do.
      } else {
        const match = detected.find((d) => d.id === id);
        if (match) onSelect({ slicerPath: match.path, slicerName: match.name });
      }
    });
  });

  container.querySelector('#browse-slicer-option').addEventListener('click', async () => {
    const picked = await window.api.slicers.browse();
    if (!picked) return;
    const name = picked.split(/[\\/]/).pop().replace(/\.(app|exe)$/i, '');
    onSelect({ slicerPath: picked, slicerName: name });
  });
}

function optionHTML({ id, name, sub, selected }) {
  return `
    <div class="slicer-option ${selected ? 'selected' : ''}" data-slicer-id="${id}">
      <span class="slicer-option-check">${selected ? icons.check : ''}</span>
      <div class="slicer-option-text">
        <div class="slicer-option-name">${escapeHtml(name)}</div>
        ${sub ? `<div class="slicer-option-sub">${escapeHtml(sub)}</div>` : ''}
      </div>
    </div>
  `;
}
