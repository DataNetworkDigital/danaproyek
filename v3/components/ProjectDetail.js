// ============================================================
// ProjectDetail — full read-only modal view of a project
// Opens via clicking ProjectCard. Edit functions link back to v2.
// ============================================================

import { fj, fjPlain, fd, du } from '../scripts/formatters.js';
import { kontrakP, publicKontrakP, profP, profUmum, calcInvestorReturn, calcAdminNetProfit, wasTaken } from '../scripts/computations.js';
import { generateSchedule, getNextDue } from '../scripts/schedule.js';
import { statusOf, typeOf } from '../scripts/status.js';
import { S, isAdmin } from '../scripts/state.js';
import { ProjectIcon } from './ProjectIcon.js';
import { Badge } from './Badge.js';
import { Progress } from './Progress.js';

export function ProjectDetail({ project: p }) {
  const admin = isAdmin();
  const status = statusOf(p, admin);
  const type = typeOf(p);
  const value = admin ? kontrakP(p) : publicKontrakP(p);
  const deploy = parseFloat(p.jumlah || 0);
  const profit = admin ? profP(p, generateSchedule) : profUmum(p, generateSchedule);
  const nd = getNextDue(p);
  const days = nd?.dueDate ? du(nd.dueDate) : null;

  // Investor allocations on this project
  const allocs = (S.external || [])
    .filter((e) => e.tipe === 'investor' && (e.alokasi || []).some((a) => a.pid === p.id))
    .map((e) => {
      const a = e.alokasi.find((x) => x.pid === p.id);
      const investorReturn = calcInvestorReturn(p, a.jumlah || 0, generateSchedule);
      return { name: e.nama, amount: a.jumlah, ret: investorReturn };
    });

  const adminNet = admin ? calcAdminNetProfit(p, generateSchedule) : 0;

  // Schedule
  if ((p.returnType || 'sekali') === 'bulanan') generateSchedule(p);
  const schedule = (p.schedule || []).filter((s) => s.status !== 'skipped');
  const skippedCount = (p.schedule || []).filter((s) => s.status === 'skipped').length;
  const paidCount = schedule.filter((s) => s.status === 'paid').length;

  return `
    <div class="pdetail">
      <!-- Hero strip -->
      <header class="pdetail__head">
        ${ProjectIcon({ project: p, size: 48 })}
        <div class="pdetail__title-block">
          <h2 class="pdetail__title">${escapeHtml(p.peminjam || 'Tanpa nama')}</h2>
          <div class="pdetail__meta">
            <span class="pdetail__type">${type.label}</span>
            <span class="pdetail__sep">·</span>
            ${Badge({ label: status.label, tone: status.tone, size: 'sm' })}
          </div>
        </div>
      </header>

      <!-- Key numbers -->
      <div class="pdetail__numbers">
        <div class="pdetail__num">
          <div class="pdetail__num-l">Nilai ${admin ? 'kontrak' : 'investasi'}</div>
          <div class="pdetail__num-v num">${fj(value)}</div>
        </div>
        ${admin ? `
        <div class="pdetail__num">
          <div class="pdetail__num-l">Deploy</div>
          <div class="pdetail__num-v num">${fj(deploy)}</div>
        </div>` : ''}
        <div class="pdetail__num">
          <div class="pdetail__num-l">${profit > 0 ? 'Yield' : 'Profit'}</div>
          <div class="pdetail__num-v num pdetail__num-v--success">${profit > 0 ? '+' + fj(profit) : '—'}</div>
        </div>
      </div>

      <!-- Timeline -->
      <section class="pdetail__section">
        <h3 class="pdetail__section-title">Periode</h3>
        <div class="pdetail__rows">
          <div class="pdetail__row"><span class="pdetail__row-l">Tanggal mulai</span><span class="pdetail__row-v num">${fd(p.tanggalMulai)}</span></div>
          <div class="pdetail__row"><span class="pdetail__row-l">Jatuh tempo</span><span class="pdetail__row-v num">${fd(p.tanggalJT)}</span></div>
          ${admin && p.tanggalAktif ? `<div class="pdetail__row"><span class="pdetail__row-l">Tanggal masuk</span><span class="pdetail__row-v num">${fd(p.tanggalAktif)}</span></div>` : ''}
          ${nd && days !== null ? `<div class="pdetail__row"><span class="pdetail__row-l">Status waktu</span><span class="pdetail__row-v ${days < 0 ? 'pdetail__row-v--error' : days <= 7 ? 'pdetail__row-v--warning' : 'text-muted'}">${days < 0 ? Math.abs(days) + ' hari telat' : days === 0 ? 'Hari ini' : days + ' hari lagi'}</span></div>` : ''}
        </div>
      </section>

      <!-- Investor allocations -->
      ${admin && allocs.length > 0 ? `
      <section class="pdetail__section">
        <h3 class="pdetail__section-title">Investor terlibat</h3>
        <div class="pdetail__rows">
          ${allocs.map((a) => `
            <div class="pdetail__row">
              <span class="pdetail__row-l">${escapeHtml(a.name)}</span>
              <span class="pdetail__row-v num">Rp ${fjPlain(a.amount)} · +Rp ${fjPlain(a.ret)}</span>
            </div>
          `).join('')}
          <div class="pdetail__row pdetail__row--highlight">
            <span class="pdetail__row-l">Net profit kamu</span>
            <span class="pdetail__row-v num pdetail__row-v--success">+Rp ${fjPlain(adminNet)}</span>
          </div>
        </div>
      </section>` : ''}

      <!-- Payment schedule -->
      ${schedule.length > 0 ? `
      <section class="pdetail__section">
        <header class="pdetail__section-head">
          <h3 class="pdetail__section-title">Jadwal pembayaran</h3>
          <span class="text-xs text-subtle num">${paidCount}/${schedule.length} terbayar</span>
        </header>
        ${skippedCount > 0 ? `<p class="pdetail__skipped">⏭️ ${skippedCount} periode dilewati (sebelum tanggal masuk)</p>` : ''}
        <div class="pdetail__schedule">
          ${schedule.map((s) => {
            const isPaid = s.status === 'paid';
            const sd = du(s.dueDate);
            const isLate = !isPaid && sd !== null && sd < 0;
            const isDue = !isPaid && sd !== null && sd >= 0 && sd <= 7;
            return `
              <div class="pdetail__sched-row ${isPaid ? 'pdetail__sched-row--paid' : ''}">
                <div class="pdetail__sched-info">
                  <div class="pdetail__sched-month">Bulan ${s.month}</div>
                  <div class="pdetail__sched-date num">${fd(s.dueDate)}</div>
                </div>
                <div class="pdetail__sched-amount num">${fj(s.amount)}${s.isFinal ? ` <span class="text-subtle">+pokok</span>` : ''}</div>
                <div class="pdetail__sched-status">
                  ${isPaid
                    ? Badge({ label: 'Lunas', tone: 'success', size: 'sm' })
                    : isLate
                    ? Badge({ label: Math.abs(sd) + ' h telat', tone: 'error', size: 'sm' })
                    : isDue
                    ? Badge({ label: sd === 0 ? 'Hari ini' : sd + ' h', tone: 'warning', size: 'sm' })
                    : Badge({ label: 'Pending', tone: 'neutral', size: 'sm' })}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </section>` : ''}

      ${p.catatan ? `
      <section class="pdetail__section">
        <h3 class="pdetail__section-title">Catatan</h3>
        <p class="pdetail__note">${escapeHtml(p.catatan)}</p>
      </section>` : ''}

      <!-- Actions -->
      ${admin ? `
      <div class="pdetail__actions">
        <a class="btn btn--secondary btn--block" href="../index.html#proj-${p.id}" target="_top">Edit di v2 →</a>
      </div>` : ''}
    </div>
  `;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
