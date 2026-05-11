// ============================================================
// Main — bootstrap, routing, header, modals, toast
// Page renderers live in render.js (commit 3+)
// ============================================================

import { S, loadLocal, loadFromFirestore, save, setAdminUnlocked, isAdmin, subscribe } from './state.js';
import { fixProjectStatuses } from './schedule.js';
import { renderBeranda, renderOps, handleAction } from './render.js';

const PIN = '110869';

let CP = 'beranda'; // current page

// ---------- Bootstrap ----------

(async function init() {
  loadLocal();
  setupHeader();
  setupNav();
  setupPin();
  setupModalDismiss();
  setupSyncIndicator();
  setupActionDelegation();

  // Initial render from local cache (instant)
  fixProjectStatuses();
  renderPage('beranda');

  // Subscribe to data changes BEFORE async load so first sync triggers re-render
  subscribe(() => renderPage(CP));

  // Pull fresh data from Firestore (read-only for public, RW for admin)
  // This makes investors see live data even on a fresh browser
  try {
    await loadFromFirestore();
    fixProjectStatuses();
    renderPage(CP);
  } catch (e) {
    console.warn('Firestore initial load failed', e);
  }
})();

// ---------- Header ----------

function setupHeader() {
  const pages = document.getElementById('pages');
  const hdr = document.getElementById('hdr');
  if (!pages || !hdr) return;
  // Subtle border on scroll
  pages.addEventListener(
    'scroll',
    () => {
      const active = pages.querySelector('.page--active');
      if (!active) return;
      hdr.classList.toggle('hdr--scrolled', active.scrollTop > 4);
    },
    true
  );
}

function setHeader(title, sub) {
  const t = document.getElementById('hdr-title');
  const s = document.getElementById('hdr-sub');
  if (t) t.textContent = title;
  if (s) s.textContent = sub;
}

// ---------- Sync indicator ----------

function setupSyncIndicator() {
  const sub = document.getElementById('hdr-sub');
  if (!sub) return;
  window.__updateSync = (state, ts) => {
    if (state === 'syncing') {
      sub.innerHTML = `<span class="sync sync--syncing"><span class="sync__dot"></span> Menyimpan…</span>`;
    } else if (state === 'error') {
      sub.innerHTML = `<span class="sync sync--error"><span class="sync__dot"></span> Sync gagal</span>`;
    } else if (state === 'synced') {
      const t = ts ? new Date(ts) : new Date();
      const fmt = t.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      sub.innerHTML = `<span class="sync"><span class="sync__dot"></span> Tersinkron · ${fmt}</span>`;
    }
  };
}

// ---------- Nav ----------

function setupNav() {
  const nav = document.getElementById('bnav');
  if (!nav) return;
  nav.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-route]');
    if (!btn) return;
    const route = btn.dataset.route;
    if (route === 'admin') {
      if (isAdmin()) {
        // Already unlocked → go to ops
        navigate('ops');
      } else {
        openModal('pin');
      }
      return;
    }
    navigate(route);
  });
}

function navigate(route) {
  CP = route;
  document.querySelectorAll('.page').forEach((p) => p.classList.remove('page--active'));
  const target = document.getElementById('p-' + route);
  if (target) target.classList.add('page--active');

  document.querySelectorAll('.bnav__item').forEach((b) => {
    b.classList.toggle('bnav__item--active', b.dataset.route === route);
  });

  renderPage(route);
}

// ---------- Render router (placeholder for commit 1) ----------

function renderPage(route) {
  if (route === 'beranda') {
    setHeader('DanaTrack', isAdmin() ? 'Mode admin' : 'Portfolio investasi');
    renderBeranda();
    toggleFab(false);
  } else if (route === 'ops') {
    setHeader('Operasi', 'Kelola proyek & dana');
    renderOps();
  } else if (route === 'doc') {
    setHeader('Dokumen', 'Generate kontrak & laporan');
    toggleFab(false);
  }
}

function toggleFab(show) {
  const fab = document.getElementById('fab');
  if (fab) fab.hidden = !show;
}

// ---------- Event delegation for component actions ----------

function setupActionDelegation() {
  document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    const ctx = { ...target.dataset, target };
    // Render-handled actions
    if (handleAction(action, ctx)) return;
    // Generic actions
    if (action === 'goto-ops') navigate('ops');
  });
}

// ---------- PIN ----------

function setupPin() {
  const pad = document.getElementById('pin-pad');
  const dots = document.getElementById('pin-dots');
  const errEl = document.getElementById('pin-error');
  if (!pad || !dots) return;

  // Build dots
  dots.innerHTML = '';
  for (let i = 0; i < 6; i++) {
    const d = document.createElement('span');
    d.className = 'pin__dot';
    d.id = 'pin-dot-' + i;
    dots.appendChild(d);
  }

  // Build pad
  pad.innerHTML = '';
  let entered = '';
  const updateDots = () => {
    for (let i = 0; i < 6; i++) {
      document.getElementById('pin-dot-' + i)?.classList.toggle('pin__dot--filled', i < entered.length);
    }
  };
  const press = async (val) => {
    if (val === 'del') {
      entered = entered.slice(0, -1);
      updateDots();
      if (errEl) errEl.textContent = '';
      return;
    }
    if (entered.length >= 6) return;
    entered += val;
    updateDots();
    if (entered.length === 6) {
      if (entered === PIN) {
        await unlockAdmin();
      } else {
        if (errEl) errEl.textContent = '✗ PIN salah';
        entered = '';
        setTimeout(() => { updateDots(); if (errEl) errEl.textContent = ''; }, 1200);
      }
    }
  };

  const keys = ['1','2','3','4','5','6','7','8','9','','0','del'];
  keys.forEach((k) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pin__key';
    if (k === '') {
      b.style.visibility = 'hidden';
    } else if (k === 'del') {
      b.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2zM18 9l-6 6M12 9l6 6"/></svg>`;
      b.onclick = () => press('del');
    } else {
      b.textContent = k;
      b.onclick = () => press(k);
    }
    pad.appendChild(b);
  });
}

async function unlockAdmin() {
  setAdminUnlocked(true);
  closeModal('pin');
  // Reveal admin nav items
  document.querySelectorAll('[data-route="ops"], [data-route="doc"]').forEach((b) => b.hidden = false);
  document.querySelector('[data-route="admin"]').hidden = true;
  toast('🔓 Admin terbuka');
  await loadFromFirestore();
  fixProjectStatuses();
  navigate('ops');
}

// ---------- Modals ----------

function openModal(id) {
  const el = document.getElementById('mo-' + id);
  if (!el) return;
  el.hidden = false;
  // Force reflow so transition runs
  void el.offsetWidth;
  el.classList.add('modal-overlay--open');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  const el = document.getElementById('mo-' + id);
  if (!el) return;
  el.classList.remove('modal-overlay--open');
  setTimeout(() => {
    el.hidden = true;
    if (!document.querySelector('.modal-overlay--open')) {
      document.body.style.overflow = '';
    }
  }, 220);
}

function setupModalDismiss() {
  document.addEventListener('click', (e) => {
    // Click outside modal
    const overlay = e.target.closest('.modal-overlay');
    if (overlay && !e.target.closest('.modal')) {
      closeModal(overlay.dataset.modal);
      return;
    }
    // Click close button
    const closeBtn = e.target.closest('[data-close]');
    if (closeBtn) {
      closeModal(closeBtn.dataset.close);
    }
  });
}

// ---------- Toast ----------

let _toastTimer = null;
function toast(msg, opts = {}) {
  const region = document.getElementById('toast');
  if (!region) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  if (opts.undo) {
    const btn = document.createElement('button');
    btn.className = 'toast__action';
    btn.textContent = '↩ Undo';
    btn.onclick = () => {
      opts.undo();
      el.remove();
    };
    el.appendChild(btn);
  }
  region.appendChild(el);
  void el.offsetWidth;
  el.classList.add('toast--show');
  const dur = opts.duration || (opts.undo ? 6000 : 2700);
  setTimeout(() => {
    el.classList.remove('toast--show');
    setTimeout(() => el.remove(), 250);
  }, dur);
}

// Expose for other modules
window.__toast = toast;
window.__navigate = navigate;
window.__openModal = openModal;
window.__closeModal = closeModal;
