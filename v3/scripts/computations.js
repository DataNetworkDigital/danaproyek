// ============================================================
// Computations — pure functions for project profit/return math
// Ported from v2. NEVER mutate inputs.
// ============================================================

import { S } from './state.js';

/** Resolved contract value (kontrak with deploy fallback). */
export function kontrakP(p) {
  return parseFloat(p.kontrak || 0) || parseFloat(p.jumlah || 0);
}

/** Public-facing value: deployBasis projects show deploy amount. */
export function publicKontrakP(p) {
  return p.deployBasis ? parseFloat(p.jumlah || 0) : kontrakP(p);
}

/** Project was actually taken (has tanggalAktif or any paid schedule item). */
export function wasTaken(p) {
  return !!(p.tanggalAktif || (p.schedule && p.schedule.some((s) => s.status === 'paid')));
}

/** Project shown as Selesai but never actually taken. */
export function isTidakTerambil(p) {
  return p.status === 'selesai' && !wasTaken(p);
}

/** Active duration (excludes skipped periods). */
export function activeDur(p, generateScheduleFn) {
  if (generateScheduleFn) generateScheduleFn(p);
  const sched = p.schedule || [];
  return sched.length > 0
    ? sched.filter((s) => s.status !== 'skipped').length
    : parseInt(p.durasiReturn || 0);
}

/** Monthly return in Rp (admin view). */
export function retBulananRp(p) {
  if (p.returnMode === 'persen') {
    return parseFloat((kontrakP(p) * parseFloat(p.returnPersen || 0) / 100).toFixed(2));
  }
  return parseFloat(p.returnBulanan || 0);
}

/** Total expected admin profit. */
export function profP(p, generateScheduleFn) {
  if (p.status === 'selesai' && !wasTaken(p)) return 0;
  const rt = p.returnType || 'sekali';
  if (rt === 'bulanan') {
    const dur = activeDur(p, generateScheduleFn);
    let rb;
    if (p.returnMode === 'persen') {
      rb = kontrakP(p) * parseFloat(p.returnPersen || 0) / 100;
    } else {
      rb = parseFloat(p.returnBulanan || 0);
    }
    return parseFloat((rb * dur).toFixed(2));
  }
  return parseFloat((kontrakP(p) - parseFloat(p.jumlah)).toFixed(2));
}

/** Total expected umum (public) profit. */
export function profUmum(p, generateScheduleFn) {
  const base = publicKontrakP(p);
  const rt = p.returnType || 'sekali';
  if (rt === 'bulanan') {
    const dur = activeDur(p, generateScheduleFn);
    let rb;
    if (p.returnModeUmum === 'persen') {
      rb = base * parseFloat(p.returnPersenUmum || 0) / 100;
    } else {
      rb = parseFloat(p.returnBulananUmum || 0);
    }
    return parseFloat((rb * dur).toFixed(2));
  }
  if (p.sekaliModeUmum === 'rupiah') return parseFloat(p.sekaliUmumRp || 0);
  if (p.sekaliUmumPersen) {
    return parseFloat((base * parseFloat(p.sekaliUmumPersen || 0) / 100).toFixed(2));
  }
  return 0;
}

/** Investor's allocated return. */
export function calcInvestorReturn(project, allocAmount, generateScheduleFn) {
  const rt = project.returnType || 'sekali';
  const amt = parseFloat(allocAmount || 0);
  const base = publicKontrakP(project);
  if (rt === 'bulanan') {
    const dur = activeDur(project, generateScheduleFn);
    let umumPerMonth;
    if (project.returnModeUmum === 'persen') {
      umumPerMonth = base * parseFloat(project.returnPersenUmum || 0) / 100;
    } else {
      umumPerMonth = parseFloat(project.returnBulananUmum || 0);
    }
    return parseFloat((umumPerMonth * (amt / base) * dur).toFixed(2));
  }
  const totalUmumProfit = profUmum(project, generateScheduleFn);
  return parseFloat((totalUmumProfit * (amt / base)).toFixed(2));
}

/** Admin fee (marketing) — carved out of gross return, per project. */
export function adminFeePersen(p) { return parseFloat(p.adminFeePersen || 0); }
export function adminFeeRecipient(p) { return p.adminFeeRecipient || 'Mas Hena'; }
export function adminFeeMonthly(p) {
  return parseFloat((kontrakP(p) * adminFeePersen(p) / 100).toFixed(2));
}
export function adminFeeTotal(p, generateScheduleFn) {
  const rt = p.returnType || 'sekali';
  if (rt === 'bulanan') return parseFloat((adminFeeMonthly(p) * activeDur(p, generateScheduleFn)).toFixed(2));
  return adminFeeMonthly(p);
}

/** Owner net profit: gross return − admin fee − NON-owner investor shares.
 *  Owners are the residual recipients, so their allocations are NOT subtracted. */
export function calcAdminNetProfit(project, generateScheduleFn) {
  const totalAdminProfit = profP(project, generateScheduleFn);
  const invs = S.external.filter(
    (e) => e.tipe === 'investor' && !e.isOwner && (e.alokasi || []).some((a) => a.pid === project.id)
  );
  let totalInvShare = 0;
  invs.forEach((e) => {
    const a = e.alokasi.find((x) => x.pid === project.id) || {};
    totalInvShare += calcInvestorReturn(project, a.jumlah || 0, generateScheduleFn);
  });
  const fee = adminFeeTotal(project, generateScheduleFn);
  return parseFloat((totalAdminProfit - totalInvShare - fee).toFixed(2));
}
