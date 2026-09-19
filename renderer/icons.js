const wrap = (paths, viewBox = '0 0 24 24') =>
  `<svg viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">${paths}</svg>`;

export const icons = {
  queue: wrap('<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h10"/>'),
  person: wrap('<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c0-4.2 3.4-6.8 7.5-6.8s7.5 2.6 7.5 6.8"/>'),
  settings: wrap(
    '<line x1="4" y1="6" x2="20" y2="6"/><circle cx="9" cy="6" r="2" fill="currentColor"/>' +
    '<line x1="4" y1="12" x2="20" y2="12"/><circle cx="15" cy="12" r="2" fill="currentColor"/>' +
    '<line x1="4" y1="18" x2="20" y2="18"/><circle cx="7" cy="18" r="2" fill="currentColor"/>'
  ),
  plus: wrap('<path d="M12 5v14"/><path d="M5 12h14"/>'),
  printer: wrap('<path d="M6 9V3h12v6"/><rect x="4" y="9" width="16" height="8" rx="1.5"/><path d="M8 21h8v-5H8z"/>'),
  clock: wrap('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5l3.2 1.8"/>'),
  scale: wrap('<circle cx="6" cy="12" r="3"/><circle cx="18" cy="12" r="3"/><line x1="9" y1="12" x2="15" y2="12"/>'),
  check: wrap('<path d="M5 12l5 5L19 7"/>'),
  x: wrap('<path d="M6 6l12 12M18 6L6 18"/>'),
  ellipsis: wrap('<circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none"/>'),
  trash: wrap('<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>'),
  chevronRight: wrap('<path d="M9 6l6 6-6 6"/>'),
  folder: wrap('<path d="M4 7a1 1 0 0 1 1-1h4l2 2h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/>'),
  grip: wrap('<circle cx="8" cy="6" r="1.2" fill="currentColor" stroke="none"/><circle cx="8" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="8" cy="18" r="1.2" fill="currentColor" stroke="none"/><circle cx="16" cy="6" r="1.2" fill="currentColor" stroke="none"/><circle cx="16" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="16" cy="18" r="1.2" fill="currentColor" stroke="none"/>'),
  seal: wrap('<circle cx="12" cy="12" r="9"/><path d="M8 12.4l2.6 2.6L16 9.5"/>'),
  box: wrap('<path d="M3.5 8L12 3.5 20.5 8 12 12.5z"/><path d="M3.5 8v9L12 21.5 20.5 17V8"/><path d="M12 12.5V21.5"/>'),
  search: wrap('<circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.8-4.8"/>'),
  layers: wrap('<path d="M12 3.5l8.5 4.5-8.5 4.5L3.5 8z"/><path d="M4.2 12l7.8 4.2L19.8 12"/><path d="M4.2 15.8L12 20l7.8-4.2"/>'),
  dollar: wrap('<line x1="12" y1="2.5" x2="12" y2="21.5"/><path d="M16.5 6.5c0-1.9-2-3-4.5-3s-4.5 1.2-4.5 3c0 4 9 2.3 9 6.3 0 1.9-2 3.2-4.5 3.2s-4.5-1.3-4.5-3.2"/>'),
  pencil: wrap('<path d="M4 20l1-4.2L15.8 5l3.2 3.2L8.2 19l-4.2 1z"/><path d="M13.8 6.2l3.2 3.2"/>'),
};
