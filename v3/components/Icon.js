// ============================================================
// Icon — SVG sprite reference
// ============================================================

/**
 * @param {object} opts
 * @param {string} opts.name — sprite id without 'i-' prefix (e.g. 'building')
 * @param {number} [opts.size=20]
 * @param {string} [opts.cls]
 */
export function Icon({ name, size = 20, cls = '' }) {
  return `<svg class="icon ${cls}" width="${size}" height="${size}" aria-hidden="true"><use href="./icons/sprite.svg#i-${name}"/></svg>`;
}

/** Inline icon for status (small, embedded). */
export function StatusIcon({ tone, size = 14 }) {
  const map = {
    success: 'circle-check',
    warning: 'clock',
    error: 'alert-triangle',
    info: 'clock',
    neutral: 'clock',
  };
  return Icon({ name: map[tone] || 'clock', size, cls: 'icon--status' });
}
