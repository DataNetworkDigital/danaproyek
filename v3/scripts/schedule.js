// ============================================================
// Schedule — payment schedule generation & next-due lookup
// Ported from v2 with skipped-period support.
// ============================================================

import { S, save } from './state.js';
import { am } from './formatters.js';
import { kontrakP, retBulananRp } from './computations.js';

/** Generate / regenerate payment schedule for a project. Mutates project.schedule. */
export function generateSchedule(project) {
  if (!project.tanggalMulai || !project.durasiReturn) return;
  const dur = parseInt(project.durasiReturn || 0);
  if (dur <= 0) return;
  const rt = project.returnType || 'sekali';
  if (rt !== 'bulanan') return;

  const existing = project.schedule || [];
  const monthlyAmt0 = retBulananRp(project);
  const amtMatch =
    existing.length > 0 &&
    Math.abs(parseFloat(existing[0].amount || 0) - monthlyAmt0) < 0.001;
  const dateMatch = existing.every(
    (s, idx) => s.status === 'paid' || s.dueDate === am(project.tanggalMulai, idx + 1)
  );
  const aktifDate = project.tanggalAktif || null;
  const needsSkipUpdate =
    aktifDate &&
    existing.some(
      (s) => s.status !== 'paid' && s.status !== 'skipped' && s.dueDate <= aktifDate
    );

  if (existing.length === dur && amtMatch && dateMatch && !needsSkipUpdate) return;

  const newSched = [];
  for (let i = 0; i < dur; i++) {
    const dueDate = am(project.tanggalMulai, i + 1);
    const old = existing[i] || null;
    const isBeforeEntry = aktifDate && dueDate <= aktifDate;
    let st = 'pending';
    if (old && old.status === 'paid') st = 'paid';
    else if (old && old.status === 'skipped') st = 'skipped';
    else if (isBeforeEntry) st = 'skipped';
    newSched.push({
      month: i + 1,
      dueDate,
      status: st,
      paidDate: st === 'paid' ? old?.paidDate || null : null,
      paidAmount: st === 'paid' ? old?.paidAmount : undefined,
      amount: monthlyAmt0,
      isFinal: i === dur - 1,
      catatan: old?.catatan,
    });
  }
  project.schedule = newSched;
}

/** Get next unpaid (and unskipped) schedule item, or null. */
export function getNextDue(project) {
  const rt = project.returnType || 'sekali';
  if (rt === 'bulanan') {
    generateSchedule(project);
    const sched = project.schedule || [];
    return sched.find((s) => s.status !== 'paid' && s.status !== 'skipped') || null;
  }
  const paid = (project.payments || []).length > 0;
  if (paid) return null;
  return {
    month: 1,
    dueDate: project.tanggalJT,
    status: 'pending',
    paidDate: null,
    amount: kontrakP(project),
    isFinal: true,
  };
}

/** Realign all unpaid schedule dueDates with tanggalMulai (one-time migration). */
export function fixScheduleDates() {
  let changed = false;
  S.projects.forEach((p) => {
    if (!p.schedule || !p.tanggalMulai) return;
    p.schedule.forEach((s, idx) => {
      const expected = am(p.tanggalMulai, idx + 1);
      if (s.dueDate !== expected && s.status !== 'paid') {
        s.dueDate = expected;
        changed = true;
      }
    });
  });
  if (changed) save();
}

/** Auto-correct project status based on actual next due date. */
export function fixProjectStatuses() {
  fixScheduleDates();
  let changed = false;
  S.projects.forEach((p) => {
    if (p.status !== 'aktif' && p.status !== 'terlambat') return;
    const nd = getNextDue(p);
    if (nd) {
      const days = (() => {
        const t = new Date();
        t.setHours(0, 0, 0, 0);
        return Math.round((new Date(nd.dueDate + 'T00:00:00') - t) / 86400000);
      })();
      if (days !== null && days < 0 && p.status === 'aktif') {
        p.status = 'terlambat';
        changed = true;
      } else if ((days === null || days >= 0) && p.status === 'terlambat') {
        p.status = 'aktif';
        changed = true;
      }
    }
  });
  if (changed) save();
}
