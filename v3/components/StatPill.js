// ============================================================
// StatPill — compact horizontal status counter (filterable)
// ============================================================

/**
 * @param {object} opts
 * @param {string} opts.label
 * @param {number} opts.count
 * @param {string} opts.tone — success|warning|neutral|error|primary
 * @param {boolean} [opts.active=true]
 * @param {string} [opts.action]
 * @param {string} [opts.value] — data-value
 */
export function StatPill({ label, count, tone = 'neutral', active = true, action, value }) {
  return `
    <button type="button" class="stat-pill stat-pill--${tone} ${active ? '' : 'stat-pill--inactive'}"
      ${action ? `data-action="${action}"` : ''}
      ${value ? `data-value="${value}"` : ''}>
      <span class="stat-pill__dot"></span>
      <span class="stat-pill__lbl">${label}</span>
      <span class="stat-pill__count num">${count}</span>
    </button>`;
}
