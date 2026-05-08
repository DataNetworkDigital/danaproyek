// ============================================================
// ProjectIcon — type-based icon container
// ============================================================

import { typeOf } from '../scripts/status.js';
import { Icon } from './Icon.js';

const TONE_BY_TYPE = {
  property:    { bg: '#F0EFFC', fg: '#4339C9' },   // indigo
  agriculture: { bg: '#E6F4EE', fg: '#00875A' },   // green
  fnb:         { bg: '#FEF6EA', fg: '#B45309' },   // amber
  services:    { bg: '#E5F0FB', fg: '#0570DE' },   // blue
  logistics:   { bg: '#FCE8EC', fg: '#B42318' },   // red
  retail:      { bg: '#FCE8FB', fg: '#9F2BA1' },   // magenta
  other:       { bg: '#F1F3F6', fg: '#5A6478' },   // neutral
};

/**
 * @param {object} opts
 * @param {object} opts.project — project data (uses .type)
 * @param {number} [opts.size=36]
 */
export function ProjectIcon({ project, size = 36 }) {
  const t = typeOf(project);
  const tone = TONE_BY_TYPE[t.key] || TONE_BY_TYPE.other;
  const iconSize = Math.round(size * 0.55);
  return `<span class="proj-icon" style="width:${size}px;height:${size}px;background:${tone.bg};color:${tone.fg}">
    ${Icon({ name: t.icon, size: iconSize })}
  </span>`;
}
