// ============================================================
// ProjectCard — compact, info-dense, fintech-styled
// ============================================================

import { fj, fd, du, gl } from '../scripts/formatters.js';
import { kontrakP, publicKontrakP, profP, profUmum, activeDur } from '../scripts/computations.js';
import { generateSchedule, getNextDue } from '../scripts/schedule.js';
import { statusOf } from '../scripts/status.js';
import { ProjectIcon } from './ProjectIcon.js';
import { Badge } from './Badge.js';
import { Progress } from './Progress.js';

/**
 * @param {object} opts
 * @param {object} opts.project
 * @param {boolean} [opts.isAdmin=false]
 */
export function ProjectCard({ project: p, isAdmin = false }) {
  const status = statusOf(p, isAdmin);
  const value = isAdmin ? kontrakP(p) : publicKontrakP(p);
  const profit = isAdmin ? profP(p, generateSchedule) : profUmum(p, generateSchedule);

  // Progress: time-based for active, 100% for completed
  let progressPct = 0;
  let progressTone = 'primary';
  let progressLabel = '';
  if (p.tanggalMulai && p.tanggalJT) {
    const start = new Date(p.tanggalMulai + 'T00:00:00').getTime();
    const end = new Date(p.tanggalJT + 'T00:00:00').getTime();
    const now = Date.now();
    progressPct = Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100));
  }
  if (status.key === 'lunas' || status.key === 'tidak-terambil') {
    progressPct = 100;
    progressTone = 'neutral';
  } else if (status.key === 'tertunda') {
    progressTone = 'error';
  } else if (status.key === 'pendanaan') {
    progressTone = 'warning';
  }

  // Next due / time remaining
  const nd = getNextDue(p);
  let timeLine = '';
  if (status.key === 'lunas') {
    timeLine = `Selesai ${fd(p.tanggalJT)}`;
  } else if (status.key === 'tidak-terambil') {
    timeLine = 'Tidak diambil';
  } else if (status.key === 'pendanaan') {
    timeLine = 'Menunggu investor';
  } else if (nd && nd.dueDate) {
    const d = du(nd.dueDate);
    if (d !== null) {
      timeLine = d < 0 ? `${Math.abs(d)} hari telat` : d === 0 ? 'Jatuh tempo hari ini' : `${d} hari lagi`;
    }
  }

  return `
    <article class="pcard" data-id="${p.id}" data-action="open-project" tabindex="0" role="button">
      <div class="pcard__head">
        ${ProjectIcon({ project: p, size: 38 })}
        <div class="pcard__title-block">
          <h3 class="pcard__title">${escapeHtml(p.peminjam || 'Tanpa nama')}</h3>
          <p class="pcard__sub">${timeLine}</p>
        </div>
        ${Badge({ label: status.label, tone: status.tone, size: 'sm' })}
      </div>

      <div class="pcard__metrics">
        <div class="pcard__metric">
          <span class="pcard__metric-l">Nilai</span>
          <span class="pcard__metric-v num">${fj(value)}</span>
        </div>
        <div class="pcard__metric pcard__metric--right">
          <span class="pcard__metric-l">${profit > 0 ? 'Yield' : 'Tipe'}</span>
          <span class="pcard__metric-v num pcard__metric-v--${profit > 0 ? 'success' : 'muted'}">
            ${profit > 0 ? '+' + fj(profit) : (p.returnType === 'bulanan' ? 'Bulanan' : 'Sekali')}
          </span>
        </div>
      </div>

      ${Progress({ value: progressPct, tone: progressTone })}
    </article>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
