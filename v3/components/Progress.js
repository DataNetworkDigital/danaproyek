// ============================================================
// Progress — slim 4px bar, label outside
// ============================================================

/**
 * @param {object} opts
 * @param {number} opts.value — 0-100
 * @param {string} [opts.tone=primary] — primary|success|warning|error|neutral
 * @param {string} [opts.label] — text shown above the bar (right-aligned)
 * @param {string} [opts.left] — text shown above the bar (left-aligned)
 * @param {boolean} [opts.striped] — barbershop pattern (for completed)
 */
export function Progress({ value, tone = 'primary', label, left, striped }) {
  const v = Math.max(0, Math.min(100, parseFloat(value) || 0));
  const head = (left || label)
    ? `<div class="progress__head">
        ${left ? `<span class="progress__l">${left}</span>` : ''}
        ${label ? `<span class="progress__lbl">${label}</span>` : ''}
      </div>`
    : '';
  return `
    <div class="progress">
      ${head}
      <div class="progress__track" role="progressbar" aria-valuenow="${v}" aria-valuemin="0" aria-valuemax="100">
        <div class="progress__fill progress__fill--${tone}${striped ? ' progress__fill--striped' : ''}" style="width:${v}%"></div>
      </div>
    </div>`;
}
