import { renderQueueView } from './views/queue.js';
import { renderSettingsView } from './views/settings.js';
import { renderOrdersIndexView } from './views/ordersIndex.js';
import { renderOrderView } from './views/orderDetail.js';
import { updateActiveTab } from './topbar.js';

export const state = {
  nav: { type: 'queue' },
};

const viewRoot = document.getElementById('view-root');

export async function navigate(nav) {
  state.nav = nav;
  await renderView();
}

export async function renderView() {
  viewRoot.scrollTop = 0;
  updateActiveTab(state.nav.type);
  switch (state.nav.type) {
    case 'settings':
      await renderSettingsView(viewRoot);
      break;
    case 'orders':
      await renderOrdersIndexView(viewRoot, state.nav.filterPersonId || null);
      break;
    case 'order':
      await renderOrderView(viewRoot, state.nav.orderId);
      break;
    case 'queue':
    default:
      await renderQueueView(viewRoot);
  }
}
