// ============================================================
// EmptyState — helpful empty view with CTA
// ============================================================

import { Icon } from './Icon.js';

/**
 * @param {object} opts
 * @param {string} [opts.icon] — sprite name
 * @param {string} opts.title
 * @param {string} [opts.body]
 * @param {string} [opts.ctaLabel]
 * @param {string} [opts.ctaAction]
 * @param {string} [opts.ctaIcon]
 * @param {string} [opts.tone=default]
 */
export function EmptyState({ icon = 'box', title, body, ctaLabel, ctaAction, ctaIcon = 'plus', tone = 'default' }) {
  return `
    <div class="empty empty--${tone}">
      <div class="empty__icon">${Icon({ name: icon, size: 24 })}</div>
      <p class="empty__title">${title}</p>
      ${body ? `<p class="empty__body">${body}</p>` : ''}
      ${ctaLabel
        ? `<button type="button" class="btn btn--ghost" ${ctaAction ? `data-action="${ctaAction}"` : ''}>
            ${Icon({ name: ctaIcon, size: 14 })}<span>${ctaLabel}</span>
          </button>`
        : ''}
    </div>`;
}
