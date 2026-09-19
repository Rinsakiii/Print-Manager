import { setCurrency } from './utils.js';
import { navigate } from './router.js';
import { renderOnboarding } from './views/onboarding.js';

async function bootstrap() {
  const settings = await window.api.settings.get();
  setCurrency(settings.currency);

  if (!settings.onboardingComplete) {
    const topbar = document.getElementById('topbar');
    topbar.classList.add('onboarding-mode');
    await renderOnboarding(document.getElementById('view-root'), async () => {
      topbar.classList.remove('onboarding-mode');
      await navigate({ type: 'queue' });
    });
    return;
  }

  await navigate({ type: 'queue' });
}

bootstrap().catch((err) => console.error('bootstrap failed', err));
