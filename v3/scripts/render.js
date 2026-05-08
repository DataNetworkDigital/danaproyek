// ============================================================
// Render — page-level renderers using components
// ============================================================

import { S, isAdmin } from './state.js';
import { kontrakP, publicKontrakP, profP, profUmum, wasTaken, isTidakTerambil } from './computations.js';
import { generateSchedule, getNextDue } from './schedule.js';
import { fjPlain, fj, du } from './formatters.js';

import { Hero } from '../components/Hero.js';
import { ProjectCard } from '../components/ProjectCard.js';
import { StatPill } from '../components/StatPill.js';
import { EmptyState } from '../components/EmptyState.js';
import { StatCard } from '../components/StatCard.js';

// Local UI state (per-page)
const _bFilter = { aktif: true, tersedia: true, selesai: true };

/* ==========================================================
   BERANDA
   ========================================================== */
export function renderBeranda() {
  const el = document.getElementById('p-beranda');
  if (!el) return;

  const admin = isAdmin();
  const projects = S.projects || [];

  // Counts
  const aktifList = projects.filter((p) => p.status === 'aktif' || p.status === 'terlambat');
  const tersediaList = projects.filter((p) => p.status === 'tersedia');
  const selesaiList = projects.filter((p) => p.status === 'selesai');

  // Hero numbers
  const totalAktif = aktifList.reduce(
    (s, p) => s + (admin ? parseFloat(p.jumlah || 0) : publicKontrakP(p)),
    0
  );
  const projectedReturn = aktifList.reduce(
    (s, p) => s + (admin ? profP(p, generateSchedule) : profUmum(p, generateSchedule)),
    0
  );
  const totalCap = projects.reduce(
    (s, p) => s + (admin ? parseFloat(p.jumlah || 0) : publicKontrakP(p)),
    0
  );
  const capUsedPct = totalCap > 0 ? (totalAktif / totalCap) * 100 : 0;

  let html = '';

  // === Hero ===
  html += Hero({
    label: admin ? 'Total modal deploy aktif' : 'Total portfolio investasi aktif',
    total: totalAktif,
    projected: projectedReturn,
    capacityUsed: capUsedPct,
    metaLeft: `${aktifList.length} berjalan · ${tersediaList.length} pendanaan`,
    metaRight: totalCap > 0 ? `${Math.round(capUsedPct)}% kapasitas` : '',
  });

  // === Filterable status pills ===
  html += `
    <div class="pills-row">
      ${StatPill({ label: 'Berjalan', count: aktifList.length, tone: 'success', active: _bFilter.aktif, action: 'toggle-filter', value: 'aktif' })}
      ${StatPill({ label: 'Pendanaan', count: tersediaList.length, tone: 'warning', active: _bFilter.tersedia, action: 'toggle-filter', value: 'tersedia' })}
      ${StatPill({ label: 'Lunas', count: selesaiList.length, tone: 'neutral', active: _bFilter.selesai, action: 'toggle-filter', value: 'selesai' })}
    </div>
  `;

  // === Filter & sort the project list ===
  const list = projects.filter((p) => {
    if ((p.status === 'aktif' || p.status === 'terlambat') && _bFilter.aktif) return true;
    if (p.status === 'tersedia' && _bFilter.tersedia) return true;
    if (p.status === 'selesai' && _bFilter.selesai) return true;
    return false;
  });

  if (list.length === 0) {
    html += EmptyState({
      icon: 'box',
      title: 'Belum ada proyek',
      body: admin
        ? 'Mulai tambahkan proyek pertama Anda dari halaman Operasi.'
        : 'Belum ada proyek yang tersedia.',
      ctaLabel: admin ? 'Buka Operasi' : null,
      ctaAction: admin ? 'goto-ops' : null,
      ctaIcon: 'arrow-up-right',
    });
  } else {
    // Group by status (default order: berjalan, pendanaan, selesai)
    const groups = [
      { key: 'aktif', label: 'Berjalan', items: list.filter((p) => p.status === 'aktif' || p.status === 'terlambat') },
      { key: 'tersedia', label: 'Pendanaan', items: list.filter((p) => p.status === 'tersedia') },
      { key: 'selesai', label: 'Lunas', items: list.filter((p) => p.status === 'selesai') },
    ];
    groups.forEach((g) => {
      if (g.items.length === 0) return;
      html += `
        <section class="section">
          <header class="section__head">
            <h2 class="section__title">${g.label}</h2>
            <span class="text-subtle text-xs num">${g.items.length}</span>
          </header>
          ${g.items.map((p) => ProjectCard({ project: p, isAdmin: admin })).join('')}
        </section>`;
    });
  }

  el.innerHTML = html;
}

/* ==========================================================
   ACTIONS — wired by main.js via event delegation
   ========================================================== */
export function handleAction(action, ctx) {
  if (action === 'toggle-filter') {
    const k = ctx.value;
    if (_bFilter[k] !== undefined) {
      _bFilter[k] = !_bFilter[k];
      renderBeranda();
    }
    return true;
  }
  if (action === 'open-project') {
    // To be wired in commit 3+ (project detail modal)
    return false;
  }
  if (action === 'goto-ops') {
    if (window.__navigate) window.__navigate('ops');
    return true;
  }
  return false;
}
