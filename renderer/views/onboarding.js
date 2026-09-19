import { icons } from '../icons.js';
import { renderSlicerPicker } from '../components/slicerPicker.js';

export async function renderOnboarding(container, onComplete) {
  let selection = { slicerPath: null, slicerName: null };

  container.innerHTML = `
    <div class="onboarding-wrap">
      <div class="onboarding-card">
        <div class="onboarding-icon">${icons.printer}</div>
        <h1 class="onboarding-title">Welcome to Print Manager</h1>
        <p class="onboarding-subtitle">Pick the slicer you use so "Send to Slicer" opens the right app. You can change this anytime in Settings.</p>
        <div class="slicer-picker" id="onboarding-slicer-picker"></div>
        <div class="onboarding-footer">
          <button class="btn btn-primary btn-large" id="onboarding-continue" type="button">${icons.check} Get Started</button>
        </div>
      </div>
    </div>
  `;

  const pickerEl = container.querySelector('#onboarding-slicer-picker');

  async function handleSelect(sel) {
    selection = sel;
    await renderSlicerPicker(pickerEl, { currentPath: selection.slicerPath, currentName: selection.slicerName, onSelect: handleSelect });
  }

  await renderSlicerPicker(pickerEl, { currentPath: null, currentName: null, onSelect: handleSelect });

  container.querySelector('#onboarding-continue').addEventListener('click', async () => {
    await window.api.settings.update({
      slicerPath: selection.slicerPath,
      slicerName: selection.slicerName,
      onboardingComplete: true,
    });
    if (onComplete) await onComplete();
  });
}
