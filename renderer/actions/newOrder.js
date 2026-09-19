import { openModal } from '../modal.js';
import { escapeHtml } from '../utils.js';

export async function openNewOrderModal(onCreated) {
  const people = await window.api.people.list();

  const { close } = openModal({
    title: 'New Order',
    width: 400,
    bodyHtml: `
      <div class="field">
        <label for="order-person-name">Customer name</label>
        <input type="text" id="order-person-name" placeholder="e.g. Jordan Lee" list="known-people" autocomplete="off" />
        <datalist id="known-people">
          ${people.map((p) => `<option value="${escapeHtml(p.name)}"></option>`).join('')}
        </datalist>
        <p class="field-hint">Type an existing customer's name to add another order for them, or a new name to start fresh.</p>
      </div>
      <div class="field">
        <label for="order-person-contact">Contact info (optional)</label>
        <input type="text" id="order-person-contact" placeholder="email or phone" autocomplete="off" />
      </div>
      <div class="form-actions">
        <button class="btn btn-secondary" id="cancel-btn" type="button">Cancel</button>
        <button class="btn btn-primary" id="save-btn" type="button">Create Order</button>
      </div>
    `,
    onMount: (el, closeFn) => {
      const nameInput = el.querySelector('#order-person-name');
      const contactInput = el.querySelector('#order-person-contact');
      nameInput.focus();

      const existingByName = new Map(people.map((p) => [p.name.toLowerCase(), p]));
      nameInput.addEventListener('input', () => {
        const match = existingByName.get(nameInput.value.trim().toLowerCase());
        if (match && match.contactInfo && !contactInput.value) {
          contactInput.value = match.contactInfo;
        }
      });

      el.querySelector('#cancel-btn').addEventListener('click', closeFn);
      el.querySelector('#save-btn').addEventListener('click', async () => {
        const name = nameInput.value.trim();
        if (!name) {
          nameInput.focus();
          return;
        }
        const order = await window.api.orders.createForPerson({
          name,
          contactInfo: contactInput.value.trim(),
        });
        closeFn();
        if (onCreated) await onCreated(order);
      });
    },
  });

  return { close };
}
