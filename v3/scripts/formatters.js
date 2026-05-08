// ============================================================
// Formatters — date, currency, time-distance
// Ported as-is from v2 + additions for v3
// ============================================================

/** Date math: add `m` months to YYYY-MM-DD string. Timezone-safe. */
export function am(s, m) {
  if (!s) return s;
  const [y, mo, da] = s.split('-').map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + m, da));
  return d.toISOString().split('T')[0];
}

/** Days until date (today = 0, past = negative). Returns null if invalid. */
export function du(s) {
  if (!s) return null;
  const d = new Date(s + 'T00:00:00');
  if (isNaN(d)) return null;
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return Math.round((d - t) / 86400000);
}

/** Human-readable distance: "3 hari lagi" / "2 hari lalu" / "Hari ini". */
export function gl(d) {
  if (d === null || d === undefined) return '';
  if (d < 0) return `${Math.abs(d)} hari lalu`;
  if (d === 0) return 'Hari ini';
  return `${d} hari lagi`;
}

/** Format date as DD MMM YYYY (Indonesian short months). */
export function fd(s) {
  if (!s) return '—';
  const d = new Date(s + 'T00:00:00');
  if (isNaN(d)) return '—';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/** Currency with Rp prefix and unit (jt / M). */
export function fj(v) {
  if (v == null) return '—';
  const n = parseFloat(v);
  if (isNaN(n)) return '—';
  if (Math.abs(n) >= 1000) {
    return `Rp ${(n / 1000).toFixed(3).replace(/0+$/, '').replace(/\.$/, '')} M`;
  }
  const s = n.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
  return `Rp ${s} jt`;
}

/** Plain number with unit, no Rp prefix (for hero displays). */
export function fjPlain(v) {
  if (v == null) return '—';
  const n = parseFloat(v);
  if (isNaN(n)) return '—';
  if (Math.abs(n) >= 1000) {
    return `${(n / 1000).toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}M`;
  }
  if (Math.abs(n) >= 1) {
    return `${n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}jt`;
  }
  return `${(n * 1000).toFixed(0)}rb`;
}

/** Pure currency number with thousand separator (no unit). */
export function fnum(v, opts = {}) {
  if (v == null) return '—';
  const n = parseFloat(v);
  if (isNaN(n)) return '—';
  const decimals = opts.decimals ?? 0;
  return n.toLocaleString('id-ID', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Percentage display. */
export function fpct(v, decimals = 1) {
  if (v == null) return '—';
  const n = parseFloat(v);
  if (isNaN(n)) return '—';
  return `${n.toFixed(decimals).replace(/\.0$/, '')}%`;
}

/** Unique id generator. */
export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2);

/** Today as YYYY-MM-DD. */
export const today = () => new Date().toISOString().split('T')[0];
