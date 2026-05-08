// ============================================================
// Badge — status pill (compact, professional)
// ============================================================

/**
 * @param {object} opts
 * @param {string} opts.label — display text
 * @param {string} [opts.tone] — success|warning|error|info|neutral|primary
 * @param {string} [opts.size] — sm|md
 * @param {string} [opts.icon] — icon name from sprite
 */
export function Badge({ label, tone = 'neutral', size = 'md', icon }) {
  const cls = `badge badge--${tone}${size === 'sm' ? ' badge--sm' : ''}`;
  const iconHtml = icon
    ? `<svg width="10" height="10" aria-hidden="true"><use href="./icons/sprite.svg#i-${icon}"/></svg>`
    : '';
  return `<span class="${cls}">${iconHtml}<span>${label}</span></span>`;
}

/** Convenience: status-tinted dot. */
export function StatusDot({ tone = 'neutral' }) {
  return `<span class="dot dot--${tone}" aria-hidden="true"></span>`;
}
