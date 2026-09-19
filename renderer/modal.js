function root() {
  return document.getElementById('modal-root');
}

export function openModal({ title, bodyHtml, width = 440, onMount, onClose }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="width:${width}px" role="dialog" aria-modal="true">
      <div class="modal-header">
        <h2>${title}</h2>
        <button class="icon-btn modal-close" type="button" aria-label="Close">&times;</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
    </div>
  `;
  root().appendChild(overlay);

  function close() {
    overlay.remove();
    document.removeEventListener('keydown', onKeydown);
    if (onClose) onClose();
  }

  function onKeydown(event) {
    if (event.key === 'Escape') close();
  }

  overlay.addEventListener('mousedown', (event) => {
    if (event.target === overlay) close();
  });
  overlay.querySelector('.modal-close').addEventListener('click', close);
  document.addEventListener('keydown', onKeydown);

  const modalEl = overlay.querySelector('.modal');
  if (onMount) onMount(modalEl, close);
  return { close, element: modalEl };
}
