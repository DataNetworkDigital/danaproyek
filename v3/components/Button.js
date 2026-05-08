// ============================================================
// Button — primary, secondary, ghost, danger variants
// ============================================================

import { Icon } from './Icon.js';

/**
 * @param {object} opts
 * @param {string} opts.label
 * @param {string} [opts.variant=primary] — primary|secondary|ghost|danger
 * @param {string} [opts.size=md] — sm|md|lg
 * @param {string} [opts.icon] — icon name (left)
 * @param {string} [opts.iconRight] — icon name (right)
 * @param {boolean} [opts.block]
 * @param {string} [opts.action] — data-action value
 * @param {object} [opts.data] — additional data attrs
 * @param {string} [opts.type=button]
 * @param {boolean} [opts.disabled]
 */
export function Button({
  label,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  block,
  action,
  data = {},
  type = 'button',
  disabled,
}) {
  const cls = [
    'btn',
    `btn--${variant}`,
    size !== 'md' && `btn--${size}`,
    block && 'btn--block',
  ]
    .filter(Boolean)
    .join(' ');
  const dataAttrs = Object.entries(data)
    .map(([k, v]) => `data-${k}="${v}"`)
    .join(' ');
  const actionAttr = action ? `data-action="${action}"` : '';
  return `<button type="${type}" class="${cls}" ${actionAttr} ${dataAttrs} ${disabled ? 'disabled' : ''}>
    ${icon ? Icon({ name: icon, size: size === 'sm' ? 14 : 16 }) : ''}
    <span>${label}</span>
    ${iconRight ? Icon({ name: iconRight, size: size === 'sm' ? 14 : 16 }) : ''}
  </button>`;
}
