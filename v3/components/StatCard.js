// ============================================================
// StatCard — single metric (icon, label, value, optional delta/trend)
// Used in: Hero, Beranda summary, Operasi sub-pages
// ============================================================

import { Icon } from './Icon.js';

/**
 * @param {object} opts
 * @param {string} opts.label
 * @param {string} opts.value — pre-formatted (string)
 * @param {string} [opts.unit] — small unit displayed after value
 * @param {string} [opts.delta] — pre-formatted delta string e.g. "+12.5jt"
 * @param {string} [opts.deltaTone=success] — success|error|neutral
 * @param {string} [opts.icon] — icon name
 * @param {string} [opts.iconTone=primary]
 * @param {string} [opts.subtext] — small text below value
 * @param {string} [opts.size=md] — sm|md
 */
export function StatCard({
  label,
  value,
  unit,
  delta,
  deltaTone = 'success',
  icon,
  iconTone = 'primary',
  subtext,
  size = 'md',
}) {
  return `
    <div class="stat-card stat-card--${size}">
      <div class="stat-card__head">
        ${icon ? `<span class="stat-card__icon stat-card__icon--${iconTone}">${Icon({ name: icon, size: 14 })}</span>` : ''}
        <span class="stat-card__label">${label}</span>
      </div>
      <div class="stat-card__value-row">
        <span class="stat-card__value num">${value}</span>
        ${unit ? `<span class="stat-card__unit">${unit}</span>` : ''}
      </div>
      ${delta
        ? `<div class="stat-card__delta stat-card__delta--${deltaTone}">${delta}</div>`
        : subtext
        ? `<div class="stat-card__sub">${subtext}</div>`
        : ''}
    </div>`;
}
