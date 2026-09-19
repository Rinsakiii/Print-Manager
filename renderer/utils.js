export function escapeHtml(value) {
  if (value == null) return '';
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

let cachedCurrency = 'USD';
export function setCurrency(code) {
  cachedCurrency = code || 'USD';
}

export function formatCurrency(amount) {
  const value = Number(amount) || 0;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: cachedCurrency }).format(value);
  } catch {
    return `$${value.toFixed(2)}`;
  }
}

export function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatMinutes(totalMinutes) {
  const m = Math.round(Number(totalMinutes) || 0);
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return h > 0 ? `${h}h ${rem}m` : `${rem}m`;
}

export function formatGrams(grams) {
  const n = Number(grams) || 0;
  return Number.isInteger(n) ? `${n}` : n.toFixed(1);
}

export function pluralize(count, noun) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}
