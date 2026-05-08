// ============================================================
// Hero — premium portfolio summary card (Phantom indigo, restrained)
// ============================================================

import { fjPlain } from '../scripts/formatters.js';
import { Icon } from './Icon.js';

/**
 * @param {object} opts
 * @param {string} opts.label — eyebrow text
 * @param {number} opts.total — main value (will format)
 * @param {number} [opts.projected] — projected return amount
 * @param {number} [opts.capacityUsed] — 0-100 percent
 * @param {string} [opts.metaLeft]
 * @param {string} [opts.metaRight]
 * @param {string} [opts.tone=primary] — primary|success
 */
export function Hero({
  label,
  total,
  projected,
  capacityUsed,
  metaLeft,
  metaRight,
  tone = 'primary',
}) {
  const totalFmt = fjPlain(total);
  return `
    <section class="hero hero--${tone}">
      <div class="hero__glow" aria-hidden="true"></div>
      <p class="hero__label">${label}</p>
      <div class="hero__value">
        <span class="hero__currency">Rp</span>
        <span class="hero__num num">${totalFmt}</span>
      </div>
      ${projected != null && projected > 0
        ? `<div class="hero__delta">
            ${Icon({ name: 'trending-up', size: 14 })}
            <span>+Rp ${fjPlain(projected)} projected return</span>
          </div>`
        : ''}
      ${capacityUsed != null
        ? `<div class="hero__progress">
            <div class="hero__bar" style="width:${Math.max(0, Math.min(100, capacityUsed))}%"></div>
          </div>`
        : ''}
      ${metaLeft || metaRight
        ? `<div class="hero__meta">
            <span>${metaLeft || ''}</span>
            <span>${metaRight || ''}</span>
          </div>`
        : ''}
    </section>`;
}
