// ============================================================
// Status — display-layer translation from v2 vocabulary to v3.
// DB stays as 'aktif'|'tersedia'|'selesai'|'terlambat' (no migration).
// ============================================================

import { isTidakTerambil } from './computations.js';

/**
 * Resolve status info for a project given the viewer mode.
 * @param {object} p — project
 * @param {boolean} isAdmin — admin view (else public)
 * @returns {{ key: string, label: string, tone: string }}
 *   key = css class suffix
 *   label = displayed text (Indonesian)
 *   tone = success|warning|error|info|neutral|primary
 */
export function statusOf(p, isAdmin = false) {
  const raw = p.status || 'aktif';

  // Public view: collapse terlambat→aktif, hide tidak-terambil distinction
  if (!isAdmin) {
    if (raw === 'tersedia') return { key: 'pendanaan', label: 'Pendanaan', tone: 'warning' };
    if (raw === 'selesai') return { key: 'lunas', label: 'Lunas', tone: 'success' };
    return { key: 'berjalan', label: 'Berjalan', tone: 'success' };
  }

  // Admin view: full vocabulary
  if (raw === 'tersedia') return { key: 'pendanaan', label: 'Pendanaan', tone: 'warning' };
  if (raw === 'terlambat') return { key: 'tertunda', label: 'Tertunda', tone: 'error' };
  if (raw === 'selesai') {
    if (isTidakTerambil(p)) return { key: 'tidak-terambil', label: 'Tidak Terambil', tone: 'neutral' };
    return { key: 'lunas', label: 'Lunas', tone: 'success' };
  }
  return { key: 'berjalan', label: 'Berjalan', tone: 'success' };
}

/** Project type display info. */
export function typeOf(p) {
  const t = p.type || 'other';
  return PROJECT_TYPES[t] || PROJECT_TYPES.other;
}

export const PROJECT_TYPES = {
  property:    { key: 'property',    label: 'Properti',     icon: 'building' },
  agriculture: { key: 'agriculture', label: 'Agrikultur',   icon: 'leaf' },
  fnb:         { key: 'fnb',         label: 'F&B',          icon: 'cup' },
  services:    { key: 'services',    label: 'Jasa',         icon: 'wrench' },
  logistics:   { key: 'logistics',   label: 'Logistik',     icon: 'truck' },
  retail:      { key: 'retail',      label: 'Retail',       icon: 'tag' },
  other:       { key: 'other',       label: 'Lainnya',      icon: 'box' },
};
