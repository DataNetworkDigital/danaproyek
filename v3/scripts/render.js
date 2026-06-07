// ============================================================
// Render — page-level renderers using components
// ============================================================

import { S, isAdmin } from './state.js';
import { kontrakP, publicKontrakP, profP, profUmum, calcAdminNetProfit, wasTaken, isTidakTerambil } from './computations.js';
import { generateSchedule, getNextDue } from './schedule.js';
import { fjPlain, fj, fd, du } from './formatters.js';

import { Hero } from '../components/Hero.js';
import { ProjectCard } from '../components/ProjectCard.js';
import { StatPill } from '../components/StatPill.js';
import { EmptyState } from '../components/EmptyState.js';
import { StatCard } from '../components/StatCard.js';
import { ProjectDetail } from '../components/ProjectDetail.js';

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
   OPERASI — sub-tabs Proyek / Dana / Eksternal
   ========================================================== */
let _opsTab = 'proyek';

export function renderOps() {
  // Show + populate sub-tabs
  const tabsEl = document.getElementById('ops-tabs');
  if (tabsEl) {
    tabsEl.hidden = false;
    tabsEl.innerHTML = `
      ${opsTabBtn('proyek', 'Proyek')}
      ${opsTabBtn('dana', 'Dana')}
      ${opsTabBtn('eksternal', 'Eksternal')}
    `;
  }
  // Show only the active pane
  ['proyek', 'dana', 'eksternal'].forEach((k) => {
    const pane = document.getElementById('p-' + k);
    if (pane) pane.hidden = k !== _opsTab;
  });
  if (_opsTab === 'proyek') renderProyek();
  else if (_opsTab === 'dana') renderDana();
  else renderEksternal();
}

function opsTabBtn(key, label) {
  const isActive = key === _opsTab;
  return `<button type="button" class="ops-tabs__btn ${isActive ? 'ops-tabs__btn--active' : ''}" data-action="ops-tab" data-tab="${key}">${label}</button>`;
}

function renderProyek() {
  const el = document.getElementById('p-proyek');
  if (!el) return;
  const projects = S.projects || [];
  const aktifList = projects.filter((p) => p.status === 'aktif' || p.status === 'terlambat');
  const tersediaList = projects.filter((p) => p.status === 'tersedia');
  const selesaiList = projects.filter((p) => p.status === 'selesai');
  const totalDeploy = aktifList.reduce((s, p) => s + parseFloat(p.jumlah || 0), 0);
  // Net profit collected so far (after investor share, excluding pokok)
  const totalProfit = projects.reduce((s, p) => {
    const rt = p.returnType || 'sekali';
    if (rt === 'bulanan') {
      if (!p.schedule || p.schedule.length === 0) return s;
      const paidMonths = p.schedule.filter((si) => si.status === 'paid').length;
      const activeMonths = p.schedule.filter((si) => si.status !== 'skipped').length;
      if (activeMonths === 0 || paidMonths === 0) return s;
      const projectNet = calcAdminNetProfit(p, generateSchedule);
      return s + parseFloat((projectNet * paidMonths / activeMonths).toFixed(2));
    }
    if ((p.payments || []).length > 0) {
      return s + calcAdminNetProfit(p, generateSchedule);
    }
    return s;
  }, 0);

  let html = '';
  // 3 stat cards (asymmetric — primary/secondary/tertiary, NOT 3-equal)
  html += `
    <div class="grid grid-3 gap-2 mb-4">
      ${StatCard({ label: 'Deploy aktif', value: 'Rp ' + fjPlain(totalDeploy), icon: 'trending-up', iconTone: 'primary', size: 'sm' })}
      ${StatCard({ label: 'Berjalan', value: aktifList.length + '', subtext: tersediaList.length + ' pendanaan', icon: 'circle-check', iconTone: 'success', size: 'sm' })}
      ${StatCard({ label: 'Profit (net)', value: 'Rp ' + fjPlain(totalProfit), icon: 'check', iconTone: 'success', size: 'sm', subtext: 'Setelah bagi hasil' })}
    </div>
  `;

  // Filterable status pills
  html += `
    <div class="pills-row" style="justify-content:flex-start;margin-bottom:var(--s-3)">
      ${StatPill({ label: 'Berjalan', count: aktifList.length, tone: 'success', active: _bFilter.aktif, action: 'toggle-filter', value: 'aktif' })}
      ${StatPill({ label: 'Pendanaan', count: tersediaList.length, tone: 'warning', active: _bFilter.tersedia, action: 'toggle-filter', value: 'tersedia' })}
      ${StatPill({ label: 'Lunas', count: selesaiList.length, tone: 'neutral', active: _bFilter.selesai, action: 'toggle-filter', value: 'selesai' })}
    </div>
  `;

  // Filtered list (admin view = full status)
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
      body: 'Tap tombol + di bawah untuk menambah proyek pertama.',
    });
  } else {
    html += list.map((p) => ProjectCard({ project: p, isAdmin: true })).join('');
  }
  el.innerHTML = html;

  // Show FAB on Proyek
  toggleFab(true, 'add-project');
}

function renderDana() {
  const el = document.getElementById('p-dana');
  if (!el) return;
  const f = S.fund || {};
  const kurOn = f.kurEnabled !== false && (f.kurAmount || 0) > 0;
  const buf = kurOn ? (f.angsuran || 0) * (f.bufferMonths || 0) : 0;
  const avail = kurOn ? (f.kurAmount || 0) - buf - (f.living || 0) : 0;
  const dep = (S.projects || []).filter((p) => p.status === 'aktif' || p.status === 'terlambat').reduce((s, p) => s + parseFloat(p.jumlah || 0), 0);
  const idle = kurOn ? Math.max(0, avail - dep) : 0;

  let html = '';
  html += Hero({
    label: 'Modal kerja tersedia',
    total: avail,
    metaLeft: kurOn ? `Sumber: KUR Rp ${fjPlain(f.kurAmount || 0)}` : 'KUR tidak aktif',
    metaRight: `Sisa: Rp ${fjPlain(idle)}`,
    capacityUsed: avail > 0 ? (dep / avail) * 100 : 0,
  });

  html += `
    <div class="grid grid-2 gap-2 mb-4">
      ${StatCard({ label: 'Terdeploy', value: 'Rp ' + fjPlain(dep), icon: 'trending-up', iconTone: 'primary', size: 'sm' })}
      ${StatCard({ label: 'Idle', value: 'Rp ' + fjPlain(idle), icon: 'clock', iconTone: 'warning', size: 'sm' })}
    </div>
    <div class="grid grid-2 gap-2 mb-4">
      ${StatCard({ label: 'Buffer cadangan', value: 'Rp ' + fjPlain(buf), subtext: `${f.bufferMonths || 0} bulan angsuran`, icon: 'check', iconTone: 'neutral', size: 'sm' })}
      ${StatCard({ label: 'Living/bln', value: 'Rp ' + fjPlain(f.living || 0), icon: 'check', iconTone: 'neutral', size: 'sm' })}
    </div>
  `;

  // Upcoming due section
  const upcoming = (S.projects || [])
    .filter((p) => p.status === 'aktif' || p.status === 'terlambat')
    .map((p) => ({ p, nd: getNextDue(p) }))
    .filter((x) => x.nd && x.nd.dueDate)
    .map(({ p, nd }) => ({ p, nd, days: du(nd.dueDate) }))
    .filter((x) => x.days !== null && x.days <= 30)
    .sort((a, b) => a.days - b.days);

  if (upcoming.length > 0) {
    html += `
      <section class="section">
        <header class="section__head">
          <h2 class="section__title">Jatuh tempo 30 hari</h2>
          <span class="text-subtle text-xs num">${upcoming.length}</span>
        </header>
        ${upcoming.map(({ p, nd, days }) => `
          <div class="card" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--s-2);padding:var(--s-3) var(--s-4)">
            <div style="min-width:0">
              <div class="text-sm font-semibold">${escapeHtml(p.peminjam)}</div>
              <div class="text-xs text-subtle num">${fd(nd.dueDate)} · Rp ${fjPlain(nd.amount)}</div>
            </div>
            <span class="badge badge--${days < 0 ? 'error' : days <= 7 ? 'warning' : 'neutral'} badge--sm">${days < 0 ? Math.abs(days) + ' h telat' : days + ' h lagi'}</span>
          </div>
        `).join('')}
      </section>
    `;
  }
  el.innerHTML = html;
  toggleFab(false);
}

function renderEksternal() {
  const el = document.getElementById('p-eksternal');
  if (!el) return;
  const investors = (S.external || []).filter((e) => e.tipe === 'investor');
  const pinjaman = (S.external || []).filter((e) => e.tipe === 'pinjaman');
  const totalInv = investors.reduce((s, e) => s + parseFloat(e.jumlah || 0), 0);
  const totalPinj = pinjaman.filter((e) => e.status !== 'selesai').reduce((s, e) => s + parseFloat(e.jumlah || 0), 0);

  let html = '';
  html += `
    <div class="grid grid-2 gap-2 mb-4">
      ${StatCard({ label: 'Total investor', value: 'Rp ' + fjPlain(totalInv), subtext: `${investors.length} orang`, icon: 'circle-check', iconTone: 'warning', size: 'sm' })}
      ${StatCard({ label: 'Total pinjaman', value: 'Rp ' + fjPlain(totalPinj), subtext: `${pinjaman.filter((e) => e.status !== 'selesai').length} aktif`, icon: 'trending-up', iconTone: 'info', size: 'sm' })}
    </div>
  `;

  // Investors section
  if (investors.length > 0) {
    html += `<section class="section"><header class="section__head"><h2 class="section__title">Investor</h2><span class="text-subtle text-xs num">${investors.length}</span></header>`;
    investors.forEach((e) => {
      const allocCount = (e.alokasi || []).length;
      html += `
        <article class="card" style="display:flex;align-items:center;gap:var(--s-3);margin-bottom:var(--s-2)">
          <span class="proj-icon" style="width:36px;height:36px;background:var(--c-warning-bg);color:var(--c-warning-strong)">
            <svg width="18" height="18"><use href="./icons/sprite.svg#i-tag"/></svg>
          </span>
          <div style="flex:1;min-width:0">
            <div class="text-sm font-semibold">${escapeHtml(e.nama)}</div>
            <div class="text-xs text-subtle">${allocCount} alokasi · ${e.bagiHasilPct || 0}% bagi hasil</div>
          </div>
          <div class="text-sm num font-bold">Rp ${fjPlain(e.jumlah || 0)}</div>
        </article>`;
    });
    html += `</section>`;
  } else {
    html += EmptyState({ icon: 'box', title: 'Belum ada investor', body: 'Tap + untuk menambah investor pertama.' });
  }

  // Loans section
  if (pinjaman.length > 0) {
    html += `<section class="section"><header class="section__head"><h2 class="section__title">Pinjaman</h2><span class="text-subtle text-xs num">${pinjaman.length}</span></header>`;
    pinjaman.forEach((e) => {
      html += `
        <article class="card" style="display:flex;align-items:center;gap:var(--s-3);margin-bottom:var(--s-2)">
          <span class="proj-icon" style="width:36px;height:36px;background:var(--c-info-bg);color:var(--c-info)">
            <svg width="18" height="18"><use href="./icons/sprite.svg#i-trending-up"/></svg>
          </span>
          <div style="flex:1;min-width:0">
            <div class="text-sm font-semibold">${escapeHtml(e.nama)}</div>
            <div class="text-xs text-subtle">Cicilan Rp ${fjPlain(e.cicilanBulan || 0)}/bln · ${e.bungaPct || 0}%</div>
          </div>
          <div class="text-sm num font-bold">Rp ${fjPlain(e.jumlah || 0)}</div>
        </article>`;
    });
    html += `</section>`;
  }

  el.innerHTML = html;
  toggleFab(true, 'add-external');
}

function toggleFab(show, action) {
  const fab = document.getElementById('fab');
  if (!fab) return;
  fab.hidden = !show;
  if (show && action) fab.dataset.action = action;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/* ==========================================================
   ACTIONS — wired by main.js via event delegation
   ========================================================== */
export function handleAction(action, ctx) {
  if (action === 'toggle-filter') {
    const k = ctx.value;
    if (_bFilter[k] !== undefined) {
      _bFilter[k] = !_bFilter[k];
      // Re-render whichever page is active
      if (document.getElementById('p-beranda').classList.contains('page--active')) renderBeranda();
      else renderProyek();
    }
    return true;
  }
  if (action === 'ops-tab') {
    _opsTab = ctx.tab;
    renderOps();
    return true;
  }
  if (action === 'open-project') {
    const id = ctx.id;
    const p = (S.projects || []).find((x) => x.id === id);
    if (!p) return true;
    const body = document.getElementById('mo-detail-body');
    if (body) body.innerHTML = ProjectDetail({ project: p });
    if (window.__openModal) window.__openModal('detail');
    return true;
  }
  if (action === 'goto-ops') {
    if (window.__navigate) window.__navigate('ops');
    return true;
  }
  return false;
}
