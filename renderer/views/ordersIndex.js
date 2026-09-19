import { icons } from '../icons.js';
import { escapeHtml, formatCurrency, pluralize } from '../utils.js';
import { navigate } from '../router.js';
import { openNewOrderModal } from '../actions/newOrder.js';

const STATUS_BADGE = {
  New: 'badge-secondary',
  'In Progress': 'badge-info',
  Completed: 'badge-success',
};

export async function renderOrdersIndexView(container, filterPersonId) {
  const allOrders = await window.api.orders.listAll();
  const orders = filterPersonId ? allOrders.filter((o) => o.personId === filterPersonId) : allOrders;
  const filterName = filterPersonId ? orders[0]?.personName : null;

  container.innerHTML = `
    <div class="view">
      <div class="view-header">
        <div>
          <h1 class="view-title">Orders</h1>
          <p class="view-subtitle">${pluralize(orders.length, 'order')}${filterName ? ` from ${escapeHtml(filterName)}` : ' across every customer.'}</p>
        </div>
        <div class="view-actions">
          <button class="btn btn-primary" id="new-order-btn" type="button">${icons.plus} New Order</button>
        </div>
      </div>
      ${filterPersonId ? `<button class="btn btn-secondary" id="clear-filter-btn" type="button" style="margin-bottom:16px;">${icons.x} Clear filter</button>` : ''}
      <div id="orders-body"></div>
    </div>
  `;

  const body = container.querySelector('#orders-body');

  if (orders.length === 0) {
    body.innerHTML = `
      <div class="empty-state">
        ${icons.box}
        <div class="empty-state-title">No Orders Yet</div>
        <div>Create an order to add a customer and start queuing their plates.</div>
      </div>
    `;
  } else {
    body.innerHTML = `
      <div class="data-table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Date</th>
              <th>Plates</th>
              <th>Status</th>
              <th style="text-align:right;">Total</th>
              <th class="col-tight"></th>
            </tr>
          </thead>
          <tbody>
            ${orders.map(orderRowHTML).join('')}
          </tbody>
        </table>
      </div>
    `;
    body.querySelectorAll('tr[data-order-id]').forEach((row) => {
      row.addEventListener('click', () => {
        navigate({ type: 'order', orderId: row.dataset.orderId });
      });
    });
  }

  container.querySelector('#new-order-btn').addEventListener('click', () => {
    openNewOrderModal((order) => navigate({ type: 'order', orderId: order.id }));
  });

  const clearBtn = container.querySelector('#clear-filter-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => navigate({ type: 'orders' }));
  }
}

function orderRowHTML(order) {
  const badgeClass = STATUS_BADGE[order.status] || 'badge-secondary';
  const date = new Date(order.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  return `
    <tr class="clickable" data-order-id="${order.id}">
      <td class="cell-title">${escapeHtml(order.personName || 'Unknown')}</td>
      <td style="color:var(--text-secondary);">${date}</td>
      <td>${pluralize(order.plateCount, 'plate')}</td>
      <td><span class="badge ${badgeClass}">${escapeHtml(order.status)}</span></td>
      <td class="col-cost">${formatCurrency(order.total)}</td>
      <td class="col-tight"><span class="row-chevron">${icons.chevronRight}</span></td>
    </tr>
  `;
}
