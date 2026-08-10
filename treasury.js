/* ============================================================================
 * treasury.js — Roxanne Capital treasury decision engine (PURE, no DOM)
 * ----------------------------------------------------------------------------
 * Every function here is pure: it takes explicit (state, config, today) and
 * returns data. No globals, no Date.now(), no DOM. This is what makes the
 * financial mathematics auditable and unit-testable under Node's test runner.
 *
 * Loaded by index.html as a plain <script> (attaches window.Treasury) AND by
 * test/*.test.js via require(). Keep it dependency-free.
 *
 * Money unit throughout = juta rupiah (jt). Dates = 'YYYY-MM-DD' strings.
 * ==========================================================================*/
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Treasury = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ── number + date helpers (timezone-safe, UTC math on date-only strings) ──
  const R4 = (x) => Math.round((+x || 0) * 1e4) / 1e4;
  const DAY = 86400000;
  function parseISO(s) { const [y, m, d] = String(s).split('-').map(Number); return Date.UTC(y, m - 1, d); }
  function isoOf(ms) { const d = new Date(ms), p = (n) => String(n).padStart(2, '0'); return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate()); }
  function addDays(s, n) { return isoOf(parseISO(s) + n * DAY); }
  function addMonths(s, n) {
    const [y, m, d] = String(s).split('-').map(Number);
    const target = new Date(Date.UTC(y, m - 1 + n, 1));
    const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    return isoOf(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(d, lastDay)));
  }
  function daysBetween(a, b) { return Math.round((parseISO(b) - parseISO(a)) / DAY); }

  // ── configurable defaults (stored in orgConfig.treasury, editable) ────────
  // No magic numbers scattered in code: every assumption lives here.
  const DEFAULT_CONFIG = {
    timing: { base: 0, conservative: 7, stress: 21 },        // inflow delay (days)
    inflowQuality: {                                          // haircut by receivable quality
      base:         { received: 1, approved: 1,    invoiced: 1,   contracted: 1,   pipeline: 0 },
      conservative: { received: 1, approved: 0.9,  invoiced: 0.8, contracted: 0.7, pipeline: 0 },
      stress:       { received: 1, approved: 0.75, invoiced: 0.6, contracted: 0.4, pipeline: 0 },
    },
    papaCall: { base: 0, conservative: 0.25, stress: 1 },     // fraction of Papa principal called
    papaNoticeDays: 30,                                       // horizon for a hypothetical Papa call
    cushionPct: 15,                                           // operating cushion vs 30d obligations
    rrprMultiplier: 1.25,                                     // safety margin on stress gap
    sinkHorizonDays: 60,                                      // pre-fund principal maturities within this window
    investorRatePct: 2,                                       // fixed monthly rate paid to investors
    fundingOrder: ['1030', '1010', '1020'],   // idle investor -> Gde -> RRPR (bridge only)
    operatingFloor: 0,                        // cash kept in Utama as transit float
    hardGuaranteeWindowDays: 60,              // window we pre-fund and net earmarks against
    timingBufferDays: 7,                      // inflows assumed this late; also sizes minBuffer
    singleBorrowerCapPct: 40,                 // warn when one deal exceeds this % of liquid cash
    ownerCashTrap: true,                      // suppress owner draw while forward buffer is thin
    tieredReturn: { m1_3: 5.5, m4_6: 6.5, cycleMonths: 6, feePct: 0.5 },
  };
  function cfgOf(orgConfig) {
    const t = (orgConfig && orgConfig.treasury) || {};
    const q = t.inflowQuality || {};
    return {
      timing: Object.assign({}, DEFAULT_CONFIG.timing, t.timing),
      inflowQuality: {
        base: Object.assign({}, DEFAULT_CONFIG.inflowQuality.base, q.base),
        conservative: Object.assign({}, DEFAULT_CONFIG.inflowQuality.conservative, q.conservative),
        stress: Object.assign({}, DEFAULT_CONFIG.inflowQuality.stress, q.stress),
      },
      papaCall: Object.assign({}, DEFAULT_CONFIG.papaCall, t.papaCall),
      papaNoticeDays: t.papaNoticeDays != null ? t.papaNoticeDays : DEFAULT_CONFIG.papaNoticeDays,
      cushionPct: t.cushionPct != null ? t.cushionPct : (orgConfig && orgConfig.cushionPct != null ? orgConfig.cushionPct : DEFAULT_CONFIG.cushionPct),
      rrprMultiplier: t.rrprMultiplier != null ? t.rrprMultiplier : DEFAULT_CONFIG.rrprMultiplier,
      sinkHorizonDays: t.sinkHorizonDays != null ? t.sinkHorizonDays : DEFAULT_CONFIG.sinkHorizonDays,
      investorRatePct: t.investorRatePct != null ? t.investorRatePct : (orgConfig && orgConfig.investorRateDefault) || DEFAULT_CONFIG.investorRatePct,
      fundingOrder: t.fundingOrder || DEFAULT_CONFIG.fundingOrder,
      operatingFloor: t.operatingFloor != null ? t.operatingFloor : DEFAULT_CONFIG.operatingFloor,
      hardGuaranteeWindowDays: t.hardGuaranteeWindowDays != null ? t.hardGuaranteeWindowDays : DEFAULT_CONFIG.hardGuaranteeWindowDays,
      timingBufferDays: t.timingBufferDays != null ? t.timingBufferDays : DEFAULT_CONFIG.timingBufferDays,
      singleBorrowerCapPct: t.singleBorrowerCapPct != null ? t.singleBorrowerCapPct : DEFAULT_CONFIG.singleBorrowerCapPct,
      ownerCashTrap: t.ownerCashTrap != null ? t.ownerCashTrap : DEFAULT_CONFIG.ownerCashTrap,
      tieredReturn: Object.assign({}, DEFAULT_CONFIG.tieredReturn, t.tieredReturn),
    };
  }

  // ── admin-fee 0% bug fix: 0 is a VALID value; only blank/invalid → default ─
  function resolveNumber(value, def) {
    if (value === '' || value === null || value === undefined) return def;
    const n = parseFloat(value);
    return isNaN(n) ? def : n;
  }

  // ── ledger balances (pure; respects account normal side) ──────────────────
  function accountsMap(accounts) {
    const m = {};
    (accounts || []).forEach((a) => { m[a.code] = a; });
    return m;
  }
  function balanceOf(ledger, accounts, code, opts) {
    const from = opts && opts.from, to = opts && opts.to;
    const a = accountsMap(accounts)[code];
    const normal = a ? a.normal : 'D'; // pockets + unknown default to asset/debit
    let d = 0, k = 0;
    (ledger || []).forEach((e) => {
      if (from && e.tanggal < from) return;
      if (to && e.tanggal > to) return;
      (e.lines || []).forEach((l) => { if (l.account === code) { d += (+l.debit || 0); k += (+l.credit || 0); } });
    });
    return R4(normal === 'D' ? d - k : k - d);
  }
  function retainedProfit(ledger, accounts, to) {
    // realized profit-to-date = pendapatan - beban (income statement roll-up)
    let rev = 0, exp = 0;
    (accounts || []).forEach((a) => {
      if (a.type === 'pendapatan') rev += balanceOf(ledger, accounts, a.code, { to });
      if (a.type === 'beban') exp += balanceOf(ledger, accounts, a.code, { to });
    });
    return R4(rev - exp);
  }

  // ── pocket roles ──────────────────────────────────────────────────────────
  // hub = transaction conduit; attack = deployable (Gde + idle investor);
  // defence = RRPR (last resort); locked = Investor Jatuh Tempo (sinking).
  const POCKET = { HUB: '1000', GDE: '1010', RRPR: '1020', IDLE_INV: '1030', SINKING: '1040' };
  function pocketBal(state, code) { return balanceOf(state.ledger, state.accounts, code); }
  function totalLiquid(state) {
    return R4((state.pockets || []).reduce((s, p) => s + pocketBal(state, p.code), 0));
  }
  function attackCash(state) { return R4(pocketBal(state, POCKET.GDE) + pocketBal(state, POCKET.IDLE_INV)); }

  // ── contract / provider classification ────────────────────────────────────
  function providerOf(state, providerId) { return (state.providers || []).find((p) => p.id === providerId); }
  function isFlexibleContract(state, c) {
    if (c.flexible) return true;
    const p = providerOf(state, c.providerId);
    return !!(p && p.subtype === 'related_party_flexible');
  }
  function isOwnerContract(state, c) {
    const p = providerOf(state, c.providerId);
    return !!(p && p.classification === 'owner_equity');
  }

  // ── obligation events (money OUT to investors) ────────────────────────────
  // Regular investor contracts: pending schedule items (return rank 2, principal rank 1).
  // Papa (flexible related-party): principal is NOT a scheduled maturity; instead it is
  // a scenario "call" (or a real withdrawal notice). Return still accrues (handled in metrics).
  function investorObligations(state, today) {
    const out = [];
    (state.contracts || []).forEach((c) => {
      if (c.status === 'selesai') return;
      if (isOwnerContract(state, c)) return;
      if (isFlexibleContract(state, c)) return; // handled by papaCallEvents
      (c.schedule || []).forEach((s) => {
        if (s.status !== 'pending') return;
        if (s.tanggal < today) { /* overdue still counts */ }
        out.push({
          date: s.tanggal, amount: -R4(s.jumlah), kind: s.tipe === 'pokok' ? 'inv_principal' : 'inv_return',
          rank: s.tipe === 'pokok' ? 1 : 2, label: (c.nama || 'Investor') + ' · ' + (s.tipe === 'pokok' ? 'pokok' : 'bagi hasil'),
        });
      });
    });
    return out;
  }
  // Papa hypothetical call as an outflow. A REAL withdrawalNotice overrides the
  // hypothetical and prevents double-counting the same requested amount.
  function papaCallEvents(state, cfg, scenario, today) {
    const out = [];
    (state.contracts || []).forEach((c) => {
      if (c.status === 'selesai' || !isFlexibleContract(state, c)) return;
      const principal = R4(c.principal != null ? c.principal : c.pokok);
      if (c.withdrawalNotice && c.withdrawalNotice.amount > 0 && c.withdrawalNotice.date) {
        // real notice wins entirely (100% of requested amount on requested date)
        out.push({ date: c.withdrawalNotice.date, amount: -R4(c.withdrawalNotice.amount), kind: 'papa_call', rank: 1, label: (c.nama || 'Papa') + ' · penarikan (notis riil)' });
      } else {
        const frac = cfg.papaCall[scenario] || 0;
        if (frac > 0) out.push({ date: addDays(today, cfg.papaNoticeDays), amount: -R4(principal * frac), kind: 'papa_call', rank: 1, label: (c.nama || 'Papa') + ' · asumsi penarikan ' + Math.round(frac * 100) + '%' });
      }
    });
    return out;
  }

  // ── project inflow events (money IN) ──────────────────────────────────────
  // one-time: principal + profit received ONCE at maturity.
  // monthly: each unpaid monthly return + principal ONCE at final maturity.
  // Quality haircut + timing delay applied per scenario.
  function projectInflows(state, cfg, scenario, today) {
    const out = [];
    const shift = cfg.timing[scenario] || 0;
    const qmap = cfg.inflowQuality[scenario] || cfg.inflowQuality.base;
    (state.projects || []).forEach((p) => {
      if (p.active === false || p.status === 'selesai') return;
      const hair = qmap[p.inflowQuality || 'contracted'];
      const hc = hair == null ? 1 : hair;
      if ((p.type || 'onetime') === 'monthly') {
        (p.monthlyReturns || []).forEach((r) => {
          if (r.status === 'paid') return;
          out.push({ date: addDays(r.date, shift), amount: R4((+r.amount || 0) * hc), kind: 'inflow', rank: 4, label: (p.name || 'Proyek') + ' · return', quality: p.inflowQuality || 'contracted' });
        });
        if (p.principalDate && !p.principalPaid) out.push({ date: addDays(p.principalDate, shift), amount: R4((+p.deploy || 0) * hc), kind: 'inflow', rank: 4, label: (p.name || 'Proyek') + ' · pokok balik', quality: p.inflowQuality || 'contracted' });
      } else {
        if (p.principalPaid) return;
        const date = addDays(p.principalDate || p.maturityDate, shift);
        const gross = R4((+p.deploy || 0) + (+p.profit || 0)); // principal + profit, ONCE
        out.push({ date, amount: R4(gross * hc), kind: 'inflow', rank: 4, label: (p.name || 'Proyek') + ' · pokok + laba', quality: p.inflowQuality || 'contracted' });
      }
    });
    return out;
  }

  // ── deterministic same-date ordering: outflows before inflows ─────────────
  // rank: 1 investor principal (+ Papa call), 2 investor return, 3 expense, 4 inflow.
  function sortEvents(events) {
    return events.slice().sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      if (a.rank !== b.rank) return a.rank - b.rank;
      return (a.label || '') < (b.label || '') ? -1 : ((a.label || '') > (b.label || '') ? 1 : 0);
    });
  }
  function buildEvents(state, cfg, scenario, today) {
    const ev = [].concat(
      investorObligations(state, today),
      papaCallEvents(state, cfg, scenario, today),
      projectInflows(state, cfg, scenario, today)
    ).filter((e) => e.date >= today);
    return sortEvents(ev);
  }

  // ── scenario cash projection ──────────────────────────────────────────────
  function projectScenario(state, cfg, scenario, today) {
    const start = totalLiquid(state);
    const events = buildEvents(state, cfg, scenario, today);
    let cash = start, minCash = start, minDate = today, firstBreach = null, maxGap = 0;
    const series = [];
    events.forEach((e) => {
      cash = R4(cash + e.amount);
      series.push({ date: e.date, amount: e.amount, cash, kind: e.kind, label: e.label });
      if (cash < minCash) { minCash = cash; minDate = e.date; }
      if (cash < -0.005 && !firstBreach) firstBreach = e.date;
      if (-cash > maxGap) maxGap = R4(-cash);
    });
    return { scenario, start, events: series, minCash: R4(minCash), minDate, firstBreach, maxGap: R4(Math.max(0, maxGap)) };
  }

  // ── obligations within N days (out) ───────────────────────────────────────
  function obligationsWithin(state, cfg, days, today, scenario) {
    const evs = [].concat(investorObligations(state, today), papaCallEvents(state, cfg, scenario || 'conservative', today))
      .filter((e) => { const d = daysBetween(today, e.date); return d >= 0 && d <= days; });
    return R4(evs.reduce((s, e) => s + (-e.amount), 0));
  }
  function cushion(state, cfg, today) { return R4(obligationsWithin(state, cfg, 30, today, 'conservative') * (cfg.cushionPct / 100)); }

  // ── required RRPR reserve = stress gap × margin + cushion ──────────────────
  function requiredRRPR(state, cfg, today) {
    const stress = projectScenario(state, cfg, 'stress', today);
    const gap = Math.max(0, -stress.minCash);
    return R4(gap * cfg.rrprMultiplier + cushion(state, cfg, today));
  }

  // Spendable cash per pocket, after floors and earmarks.
  // 1040 (sinking) is structurally un-spendable: the moment it can fund a deal,
  // the principal guarantee is fiction.
  function freeCashByPocket(state, cfg, today) {
    const windowEnd = addDays(today, cfg.hardGuaranteeWindowDays);
    // Papa's assumed call (or a real withdrawal notice) is a claim on idle cash too.
    const dueInWindow = [].concat(
      investorObligations(state, today),
      papaCallEvents(state, cfg, 'conservative', today)
    ).filter((e) => e.date <= windowEnd)
      .reduce((s, e) => s - e.amount, 0);           // obligations are negative amounts
    const staged = pocketBal(state, POCKET.SINKING);
    const unstagedEarmark = Math.max(0, R4(dueInWindow - staged));
    return {
      '1000': R4(Math.max(0, pocketBal(state, POCKET.HUB) - cfg.operatingFloor)),
      '1010': R4(Math.max(0, pocketBal(state, POCKET.GDE))),
      '1020': R4(Math.max(0, pocketBal(state, POCKET.RRPR) - requiredRRPR(state, cfg, today))),
      '1030': R4(Math.max(0, pocketBal(state, POCKET.IDLE_INV) - unstagedEarmark)),
      '1040': 0,
    };
  }

  // ── safe attack budget: deployable TODAY without endangering obligations ──
  // Excludes RRPR + sinking ALWAYS. Also nets out near obligations not covered
  // by reliable (conservative) inflow, and a cushion.
  function safeAttackBudget(state, cfg, today) {
    const cash = attackCash(state); // Gde + idle investor only (retained profit sits in Gde)
    const oblig30 = obligationsWithin(state, cfg, 30, today, 'conservative');
    const sinking = pocketBal(state, POCKET.SINKING);
    // reliable inflow within 30d (conservative)
    const inflow30 = projectInflows(state, cfg, 'conservative', today)
      .filter((e) => { const d = daysBetween(today, e.date); return d >= 0 && d <= 30; })
      .reduce((s, e) => s + e.amount, 0);
    const reserved = Math.max(0, oblig30 - Math.max(0, inflow30) - Math.max(0, sinking));
    return R4(Math.max(0, cash - reserved - cushion(state, cfg, today)));
  }

  // Deterministic waterfall. Proposes only — guaranteeGate() decides if it is safe.
  function pickSourcesForDeal(state, cfg, deal) {
    const free = freeCashByPocket(state, cfg, deal.today || state.today);
    let rem = R4(deal.ticket);
    const mix = [];
    (cfg.fundingOrder || []).forEach((code) => {
      if (rem <= 0.0001 || code === POCKET.SINKING) return;
      const take = R4(Math.min(rem, free[code] || 0));
      if (take <= 0.0001) return;
      const bridge = code === POCKET.RRPR;
      mix.push({ code, amount: take, bridge, restoreBy: bridge ? (deal.maturityDate || null) : null });
      rem = R4(rem - take);
    });
    return { mix, shortfall: R4(Math.max(0, rem)), usesBridge: mix.some((m) => m.bridge) };
  }

  // The guarantee proof. For each dated investor obligation, project cash-on-hand
  // at that date under stress (inflows late + haircut). All pockets count as payable
  // here: RRPR and the sinking fund exist precisely to pay investors.
  function paymentLadder(state, cfg, today, opts) {
    opts = opts || {};
    const shift = cfg.timingBufferDays;
    const qual = cfg.inflowQuality.conservative;

    // Overdue obligations are money we ALREADY owe: clamp them to today rather than
    // dropping them, or the guarantee quietly forgets an unpaid investor.
    const obligations = [].concat(
      investorObligations(state, today),
      papaCallEvents(state, cfg, 'conservative', today)
    ).map((e) => (e.date < today ? Object.assign({}, e, { date: today, overdue: true }) : e))
     .sort((a, b) => (a.date < b.date ? -1 : 1));

    // A borrower who is already past due and still has not paid is NOT cash in hand.
    // Counting a late inflow is how a defaulting project turns into a false green light.
    const inflows = projectInflows(state, cfg, 'conservative', today)
      .filter((i) => i.date >= today);
    if (opts.deal && opts.deal.maturityDate) {
      const d = opts.deal;
      const hc = qual[d.inflowQuality || 'contracted'];
      inflows.push({
        date: addDays(d.maturityDate, shift),
        amount: R4((R4(d.ticket) + R4(d.profit || 0)) * (hc == null ? 1 : hc)),
        kind: 'inflow', label: (d.name || 'Proyek baru') + ' · pokok + laba',
      });
    }

    const drawn = (opts.mix || []).reduce((s, m) => s + R4(m.amount), 0);
    const startCash = R4(totalLiquid(state) - drawn);

    // minBuffer = timing cushion sized on the near-term outflow rate
    const near = obligations.filter((e) => daysBetween(today, e.date) <= 30)
      .reduce((s, e) => s - e.amount, 0);
    const minBuffer = R4(near / 30 * cfg.timingBufferDays);

    const rows = [];
    let minGap = Infinity, firstBreach = null;
    obligations.forEach((o) => {
      // Cash-in-advance: an inflow landing ON the due date is too late to pay it.
      const landed = inflows.filter((i) => i.date < o.date).reduce((s, i) => s + i.amount, 0);
      const paidOut = obligations.filter((x) => x.date <= o.date).reduce((s, x) => s - x.amount, 0);
      const cash = R4(startCash + landed - paidOut);
      const covered = cash >= -0.005;
      const tight = covered && cash < minBuffer;
      if (cash < minGap) minGap = cash;
      if (!covered && !firstBreach) firstBreach = { date: o.date, label: o.label };
      rows.push({
        date: o.date, label: o.label, kind: o.kind,
        obligation: R4(-o.amount), cumulativeCash: cash, covered, tight,
      });
    });
    return { rows, minBuffer, minGap: rows.length ? R4(minGap) : R4(startCash), firstBreach, startCash };
  }

  // One plain verdict from the ladder. RED = a dated payment breaks; YELLOW = covered
  // but thin, bridged, or concentrated; GREEN = safe with buffer to spare.
  function guaranteeGate(state, cfg, deal, mix, today) {
    const ladder = paymentLadder(state, cfg, today, { deal: deal, mix: mix });
    const usesBridge = (mix || []).some((m) => m.bridge);
    const liquid = totalLiquid(state);
    const exposurePct = liquid > 0 ? R4(R4(deal.ticket) / liquid * 100) : 0;
    const overConcentrated = exposurePct > cfg.singleBorrowerCapPct;
    const funded = R4((mix || []).reduce((s, m) => s + R4(m.amount), 0));
    const shortfall = R4(Math.max(0, R4(deal.ticket) - funded));

    // A deal we cannot fully fund is never "just cautious" — there is no money for it.
    if (shortfall > 0.005) {
      return {
        verdict: 'RED', ladder, exposurePct, usesBridge, shortfall,
        firstBreach: ladder.firstBreach,
        reason: 'Dana tidak cukup: kurang ' + shortfall + ' jt dari kantong yang boleh dipakai.',
      };
    }
    if (ladder.firstBreach) {
      return {
        verdict: 'RED', ladder, exposurePct, usesBridge, shortfall,
        firstBreach: ladder.firstBreach,
        reason: 'Kewajiban ' + ladder.firstBreach.label + ' pada ' + ladder.firstBreach.date + ' tidak tertutup.',
      };
    }
    const reasons = [];
    if (ladder.minGap < ladder.minBuffer) reasons.push('sisa kas menipis di salah satu tanggal');
    if (usesBridge) reasons.push('memakai cadangan RRPR (harus dikembalikan)');
    if (overConcentrated) reasons.push('proyek ini ' + exposurePct + '% dari kas likuid');
    if (reasons.length) {
      return { verdict: 'YELLOW', ladder, exposurePct, usesBridge, shortfall, firstBreach: null,
        reason: reasons.join('; ') + '.' };
    }
    const lastDate = ladder.rows.length ? ladder.rows[ladder.rows.length - 1].date : null;
    return { verdict: 'GREEN', ladder, exposurePct, usesBridge, shortfall, firstBreach: null,
      reason: lastDate ? 'Semua kewajiban investor tertutup sampai ' + lastDate + '.' : 'Tidak ada kewajiban investor terjadwal.' };
  }

  // Advisory, not gatekeeping: given a deal we WILL enter, how much extra cash must
  // arrive and by when so no investor payment is missed. Gde always takes the deal;
  // the engine's job is to name the requirement, not to refuse.
  function fundingNeed(state, cfg, deal, mix, today) {
    const funded = R4((mix || []).reduce((s, m) => s + R4(m.amount), 0));
    const shortfallNow = R4(Math.max(0, R4(deal.ticket || 0) - funded));
    // Model the FULL ticket leaving now, including the part we cannot fund yet,
    // so the requirement covers the real hole rather than a partially-funded one.
    const ladder = paymentLadder(state, cfg, today, {
      deal: deal, mix: [{ code: POCKET.GDE, amount: R4(deal.ticket || 0) }],
    });
    let worst = 0, byDate = null;
    ladder.rows.forEach((r) => {
      const deficit = R4(-r.cumulativeCash);
      if (deficit > worst) worst = deficit;
      if (deficit > 0.005 && !byDate) byDate = r.date;
    });
    const injection = R4(Math.max(0, worst));
    return {
      shortfallNow, injection,
      byDate: shortfallNow > 0.005 ? today : byDate,
      total: R4(Math.max(shortfallNow, injection)),
      ladder,
    };
  }

  // Largest ticket that still passes the gate. Min-gap is monotonic in ticket,
  // so a bisection converges quickly. Returns the ticket plus why the full one failed.
  function maxSafeTicket(state, cfg, deal, today) {
    const fullTicket = R4(deal.ticket || totalLiquid(state));
    const test = (t) => {
      if (t <= 0) return true;
      const d = Object.assign({}, deal, { ticket: t, today: today });
      const mix = pickSourcesForDeal(state, cfg, d).mix;
      // "Aman maksimal" must mean GREEN: a ticket that merely avoids RED leaves
      // zero cushion, and we show this number as the safe ceiling.
      return guaranteeGate(state, cfg, d, mix, today).verdict === 'GREEN';
    };
    if (test(fullTicket)) return { ticket: fullTicket, limited: false, breach: null };
    let lo = 0, hi = fullTicket;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (test(mid)) lo = mid; else hi = mid;
    }
    const gate = guaranteeGate(state, cfg, Object.assign({}, deal, { ticket: fullTicket, today: today }),
      pickSourcesForDeal(state, cfg, Object.assign({}, deal, { ticket: fullTicket, today: today })).mix, today);
    return { ticket: R4(Math.floor(lo * 100) / 100), limited: true, breach: gate.firstBreach };
  }

  // Tiered monthly return for a new deal: cheap months first, stepping up, cycling.
  // Fee is netted per month (0 is a valid fee and must survive).
  function buildTieredSchedule(deploy, startDate, tenorMonths, tcfg) {
    const t = Object.assign({}, DEFAULT_CONFIG.tieredReturn, tcfg || {});
    const half = Math.max(1, Math.round(t.cycleMonths / 2));
    const out = [];
    for (let k = 1; k <= tenorMonths; k++) {
      const posInCycle = ((k - 1) % t.cycleMonths) + 1;
      const ratePct = posInCycle <= half ? t.m1_3 : t.m4_6;
      const gross = R4(R4(deploy) * ratePct / 100);
      const fee = R4(R4(deploy) * resolveNumber(t.feePct, DEFAULT_CONFIG.tieredReturn.feePct) / 100);
      out.push({ date: addMonths(startDate, k), monthIndex: k, ratePct, gross, fee, amount: R4(gross - fee) });
    }
    return out;
  }

  // ── maturity ladder (per 7/30/60/90 days) ─────────────────────────────────
  function maturityLadder(state, cfg, today, scenario) {
    scenario = scenario || 'conservative';
    const sc = projectScenario(state, cfg, scenario, today);
    const invOb = investorObligations(state, today);
    const papa = papaCallEvents(state, cfg, scenario, today);
    const infl = projectInflows(state, cfg, scenario, today);
    const sinking = pocketBal(state, POCKET.SINKING);
    return [7, 30, 60, 90].map((h) => {
      const inRange = (d) => { const x = daysBetween(today, d); return x >= 0 && x <= h; };
      const principal = R4(invOb.filter((e) => e.kind === 'inv_principal' && inRange(e.date)).reduce((s, e) => s - e.amount, 0));
      const ret = R4(invOb.filter((e) => e.kind === 'inv_return' && inRange(e.date)).reduce((s, e) => s - e.amount, 0));
      const papaCall = R4(papa.filter((e) => inRange(e.date)).reduce((s, e) => s - e.amount, 0));
      const inflow = R4(infl.filter((e) => inRange(e.date)).reduce((s, e) => s + e.amount, 0));
      // uncovered = worst cash dip within horizon
      let cash = sc.start, minC = sc.start;
      sc.events.forEach((e) => { if (inRange(e.date)) { cash = R4(cash + e.amount); if (cash < minC) minC = cash; } });
      return { days: h, principal, ret, papaCall, inflow, sinking: R4(sinking), outgo: R4(principal + ret + papaCall), uncovered: R4(Math.max(0, -minC)) };
    });
  }

  // ── concentration ─────────────────────────────────────────────────────────
  function concentration(state, cfg, today) {
    const deploys = (state.projects || []).filter((p) => p.active !== false && p.status !== 'selesai')
      .map((p) => ({ name: p.name, v: R4(+p.deploy || 0) })).sort((a, b) => b.v - a.v);
    const totExp = deploys.reduce((s, e) => s + e.v, 0);
    const exposure = { pct: totExp > 0 ? R4(deploys[0].v / totExp * 100) : 0, label: deploys[0] ? deploys[0].name : '—', total: R4(totExp) };
    const obs = investorObligations(state, today).filter((e) => e.kind === 'inv_principal')
      .map((e) => ({ label: e.label, v: -e.amount })).sort((a, b) => b.v - a.v);
    const totOb = obs.reduce((s, e) => s + e.v, 0);
    const maturity = { pct: totOb > 0 ? R4(obs[0].v / totOb * 100) : 0, label: obs[0] ? obs[0].label : '—', total: R4(totOb) };
    return { exposure, maturity };
  }

  // ── return-allocation waterfall ───────────────────────────────────────────
  // Given incoming project cash, recommend where it goes:
  // 1) fund sinking for near principal maturities, 2) restore RRPR to required,
  // 3) reserve accrued-due obligations, 4) remainder → free attack capital.
  function returnWaterfall(state, cfg, amount, today) {
    amount = R4(amount);
    let rem = amount;
    const sinking = pocketBal(state, POCKET.SINKING);
    const principalSoon = investorObligations(state, today)
      .filter((e) => e.kind === 'inv_principal' && daysBetween(today, e.date) <= cfg.sinkHorizonDays && daysBetween(today, e.date) >= -3650)
      .reduce((s, e) => s - e.amount, 0);
    const sinkNeed = Math.max(0, R4(principalSoon - sinking));
    const toSinking = R4(Math.min(rem, sinkNeed)); rem = R4(rem - toSinking);
    const rrpr = pocketBal(state, POCKET.RRPR), rrprReq = requiredRRPR(state, cfg, today);
    const rrprNeed = Math.max(0, R4(rrprReq - rrpr));
    const toRRPR = R4(Math.min(rem, rrprNeed)); rem = R4(rem - toRRPR);
    // accrued bagi-hasil terutang currently due (2010 balance capped by amount left)
    const accrued = balanceOf(state.ledger, state.accounts, '2010');
    const toDue = R4(Math.min(rem, Math.max(0, accrued))); rem = R4(rem - toDue);
    // Owner spread is the residual claim: hold it back while any near obligation
    // is still unfunded. Over-releasing here is how a guarantee quietly breaks.
    const ladderAfter = paymentLadder(state, cfg, today, {});
    const trapped = !!cfg.ownerCashTrap && (ladderAfter.firstBreach !== null || sinkNeed > 0.005 || rrprNeed > 0.005);
    const freeAttack = trapped ? 0 : R4(Math.max(0, rem));
    return {
      total: amount,
      ownerTrapped: trapped,
      steps: [
        { to: 'Investor Jatuh Tempo (sinking)', code: POCKET.SINKING, amount: toSinking, why: 'Pra-danai pokok investor yang jatuh tempo ≤ ' + cfg.sinkHorizonDays + ' hari.' },
        { to: 'RRPR (cadangan)', code: POCKET.RRPR, amount: toRRPR, why: 'Pulihkan cadangan sampai target ' + R4(rrprReq) + '.' },
        { to: 'Bagi hasil terutang', code: '2010', amount: toDue, why: 'Sisihkan untuk bagi hasil yang sudah jatuh tempo.' },
        { to: trapped ? 'Ditahan (kewajiban belum aman)' : 'Modal Serang (Gde)', code: POCKET.GDE, amount: freeAttack, why: trapped ? 'Untung ditahan dulu sampai semua kewajiban investor aman.' : 'Sisanya bebas untuk proyek baru.' },
      ].filter((s) => s.amount > 0.0001 || s.code === POCKET.GDE),
      freeAttack: freeAttack,
    };
  }

  // ── project-funding recommendation (source waterfall + safety gate) ───────
  function fundingRecommendation(state, cfg, deploy, opts) {
    deploy = R4(deploy); opts = opts || {};
    const emergency = !!opts.emergency;
    const idle = pocketBal(state, POCKET.IDLE_INV), gde = pocketBal(state, POCKET.GDE), rrpr = pocketBal(state, POCKET.RRPR);
    let rem = deploy;
    const fromIdle = R4(Math.min(rem, Math.max(0, idle))); rem = R4(rem - fromIdle);
    const fromGde = R4(Math.min(rem, Math.max(0, gde))); rem = R4(rem - fromGde);
    const fromRRPR = emergency ? R4(Math.min(rem, Math.max(0, rrpr))) : 0; rem = R4(rem - fromRRPR);
    const shortfall = R4(Math.max(0, rem));

    // simulate AFTER: reduce attack cash now, add inflow at maturity (contracted quality)
    const before = projectScenario(state, cfg, 'conservative', opts.today || firstToday(state));
    const today = opts.today || firstToday(state);
    const simState = withSimulatedProject(state, { deploy, startDate: opts.startDate || today, maturityDate: opts.maturityDate, profit: opts.profit || 0, inflowQuality: opts.inflowQuality || 'contracted', fromRRPR, fromGde, fromIdle });
    const after = projectScenario(simState, cfg, 'conservative', today);
    const rrprBefore = requiredRRPR(state, cfg, today), rrprAfter = requiredRRPR(simState, cfg, today);

    const blockReasons = [];
    if (shortfall > 0.0001) blockReasons.push('Sumber dana kurang ' + shortfall + ' jt (idle + Gde' + (emergency ? ' + RRPR' : '') + ' tidak cukup).');
    if (after.minCash < -0.005) blockReasons.push('Likuiditas konservatif jadi negatif (' + after.minCash + ' jt) pada ' + (after.firstBreach || after.minDate) + '.');
    if (fromRRPR > 0 && !emergency) blockReasons.push('Memakai RRPR tanpa mode darurat.');
    if (fromRRPR > 0 && emergency && !opts.repaymentPlan) blockReasons.push('Pakai RRPR wajib disertai rencana pengembalian.');

    return {
      deploy, sources: { idleInvestor: fromIdle, gde: fromGde, rrpr: fromRRPR }, shortfall,
      before: { minCash: before.minCash, firstBreach: before.firstBreach, rrprRequired: rrprBefore, idle: R4(idle), gde: R4(gde), rrpr: R4(rrpr) },
      after: { minCash: after.minCash, firstBreach: after.firstBreach, rrprRequired: rrprAfter, idle: R4(idle - fromIdle), gde: R4(gde - fromGde), rrpr: R4(rrpr - fromRRPR) },
      ok: blockReasons.length === 0, blockReasons,
    };
  }
  function firstToday(state) { return (state && state.today) || '2026-08-03'; }
  // Build a shallow clone with a hypothetical deploy applied to the ledger (cash out now, project inflow later).
  function withSimulatedProject(state, sim) {
    const clone = Object.assign({}, state);
    clone.ledger = (state.ledger || []).slice();
    clone.projects = (state.projects || []).slice();
    const lines = [{ account: '1100', debit: sim.deploy, credit: 0 }];
    if (sim.fromIdle > 0) lines.push({ account: POCKET.IDLE_INV, debit: 0, credit: sim.fromIdle });
    if (sim.fromGde > 0) lines.push({ account: POCKET.GDE, debit: 0, credit: sim.fromGde });
    if (sim.fromRRPR > 0) lines.push({ account: POCKET.RRPR, debit: 0, credit: sim.fromRRPR });
    clone.ledger.push({ id: 'sim', tanggal: sim.startDate, memo: 'SIMULASI deploy', lines });
    clone.projects.push({ id: 'sim', name: 'SIMULASI', deploy: sim.deploy, type: 'onetime', profit: sim.profit, principalDate: sim.maturityDate, inflowQuality: sim.inflowQuality });
    return clone;
  }

  // ── allocation validation (unified model) ─────────────────────────────────
  function providerAvailable(state, providerId) {
    const p = providerOf(state, providerId);
    if (!p) return 0;
    if (p.classification === 'owner_equity') {
      // owner capacity = their equity account balance (Gde=3000, RRPR=3010)
      const code = p.subtype === 'owner_rrpr' ? '3010' : '3000';
      return balanceOf(state.ledger, state.accounts, code);
    }
    // investor capacity = sum of their contract principals
    return R4((state.contracts || []).filter((c) => c.providerId === providerId).reduce((s, c) => s + R4(c.principal != null ? c.principal : c.pokok), 0));
  }
  function validateAllocations(state) {
    const errors = [];
    const allocs = state.allocations || [];
    // duplicate allocation ids
    const seen = {};
    allocs.forEach((a) => { if (seen[a.id]) errors.push('Alokasi id duplikat: ' + a.id); seen[a.id] = 1; });
    // per-project: total allocations must equal deploy
    (state.projects || []).forEach((p) => {
      const tot = R4(allocs.filter((a) => a.projectId === p.id).reduce((s, a) => s + R4(a.amount), 0));
      if (Math.abs(tot - R4(+p.deploy || 0)) > 0.005) errors.push('Proyek ' + (p.name || p.id) + ': alokasi ' + tot + ' ≠ deploy ' + R4(+p.deploy || 0) + '.');
    });
    // per-provider: not over-allocated vs available
    const byProv = {};
    allocs.forEach((a) => { const pid = a.providerId || a.contractId || a.ownerSourceId; if (!pid) return; byProv[pid] = R4((byProv[pid] || 0) + R4(a.amount)); });
    Object.keys(byProv).forEach((pid) => {
      const avail = providerAvailable(state, pid);
      if (byProv[pid] - avail > 0.005) errors.push('Provider ' + pid + ' over-alokasi: ' + byProv[pid] + ' > tersedia ' + avail + '.');
    });
    return { ok: errors.length === 0, errors };
  }

  // ── idempotent posting guard ──────────────────────────────────────────────
  function hasPosted(ledger, idempotencyKey) {
    return (ledger || []).some((e) => e.idem === idempotencyKey || e.ref === idempotencyKey);
  }

  // ── metrics (sales material). ROE denominator = TRUE owner equity only ────
  function metrics(state, cfg, today) {
    const eq = (code) => balanceOf(state.ledger, state.accounts, code);
    const ownerEquity = R4(eq('3000') + eq('3010') + eq('3900') + retainedProfit(state.ledger, state.accounts, null));
    const investorLiab = eq('2000'); // includes Papa (correct: Papa stays a liability + leverage)
    const flexLiab = R4((state.contracts || []).filter((c) => isFlexibleContract(state, c) && !isOwnerContract(state, c)).reduce((s, c) => s + R4(c.principal != null ? c.principal : c.pokok), 0));
    const regularLiab = R4(investorLiab - flexLiab);
    const deployed = eq('1100');
    const liquid = totalLiquid(state);
    const AUM = R4(liquid + deployed);
    // laba bulan berjalan (proyeksi): net project inflow 30d − investor bagi hasil 30d − Papa accrual
    const in30 = projectInflows(state, cfg, 'base', today).filter((e) => e.label.indexOf('return') >= 0 || e.label.indexOf('laba') >= 0).filter((e) => daysBetween(today, e.date) >= 0 && daysBetween(today, e.date) <= 30).reduce((s, e) => s + e.amount, 0);
    const bh30 = investorObligations(state, today).filter((e) => e.kind === 'inv_return' && daysBetween(today, e.date) >= 0 && daysBetween(today, e.date) <= 30).reduce((s, e) => s - e.amount, 0);
    const papaAccrual = R4((state.contracts || []).filter((c) => isFlexibleContract(state, c) && !isOwnerContract(state, c)).reduce((s, c) => s + R4(c.principal != null ? c.principal : c.pokok) * cfg.investorRatePct / 100, 0));
    const labaBln = R4(in30 - bh30 - papaAccrual);
    const yieldBln = deployed > 0 ? R4(in30 / deployed * 100) : 0;
    return {
      AUM, ownerEquity, investorLiab: R4(investorLiab), regularLiab, flexLiab, deployed: R4(deployed), liquid,
      leverage: ownerEquity > 0 ? R4(investorLiab / ownerEquity) : 0,
      roe: ownerEquity > 0 ? R4(labaBln / ownerEquity * 100) : 0,
      roiAset: deployed > 0 ? R4(labaBln / deployed * 100) : 0,
      spread: R4(yieldBln - cfg.investorRatePct), yieldBln, labaBln,
      freeAttack: safeAttackBudget(state, cfg, today),
      rrprActual: R4(pocketBal(state, POCKET.RRPR)), rrprRequired: requiredRRPR(state, cfg, today),
    };
  }

  // ── INCOME BREAKDOWN: who gets what out of a period's earnings ────────────
  // Realized, from the ledger, for [from..to]:
  //   4000 pendapatan  = gross return booked from projects
  //   5020 beban fee   = Mas Hena's admin fee
  //   5000 beban bagi hasil = investors' 2%/bln (incl. Papa's accrual)
  //   sisanya = owner profit, split pro-rata by paid-in owner capital (Gde vs RRPR).
  function incomeBreakdown(state, cfg, from, to) {
    const bal = (code) => balanceOf(state.ledger, state.accounts, code, { from, to });
    const gross = R4(bal('4000'));
    const masHena = R4(bal('5020'));
    const investor = R4(bal('5000'));
    const lain = R4(bal('5010') + bal('5030'));
    const ownerProfit = R4(gross - masHena - investor - lain);
    // owner capital as of the period end decides the split
    const modalGde = balanceOf(state.ledger, state.accounts, '3000', { to });
    const modalRRPR = balanceOf(state.ledger, state.accounts, '3010', { to });
    const totalModal = R4(modalGde + modalRRPR);
    const shareGde = totalModal > 0 ? modalGde / totalModal : 1;
    const gde = R4(ownerProfit * shareGde);
    const rrpr = R4(ownerProfit - gde);
    return {
      from: from || null, to: to || null,
      gross, masHena, investor, lain, ownerProfit,
      gde, rrpr,
      splitPct: { gde: R4(shareGde * 100), rrpr: R4((1 - shareGde) * 100) },
      modalGde: R4(modalGde), modalRRPR: R4(modalRRPR),
      marginPct: gross > 0 ? R4(ownerProfit / gross * 100) : 0,
    };
  }

  // Everything a monthly one-pager needs, derived (never re-typed).
  function deckMetrics(state, cfg, from, to, today) {
    const inc = incomeBreakdown(state, cfg, from, to);
    const m = metrics(state, cfg, today || to);
    const roeBulan = m.ownerEquity > 0 ? R4(inc.ownerProfit / m.ownerEquity * 100) : 0;
    // A period report must describe the period that HAPPENED, not a forward
    // projection: derive yield/spread/ROI from the realized ledger for [from..to].
    const deployedAsOf = balanceOf(state.ledger, state.accounts, '1100', { to });
    const yieldRealisasi = deployedAsOf > 0 ? R4(inc.gross / deployedAsOf * 100) : 0;
    const roiRealisasi = deployedAsOf > 0 ? R4(inc.ownerProfit / deployedAsOf * 100) : 0;
    const spreadRealisasi = R4(yieldRealisasi - cfg.investorRatePct);
    const conc = concentration(state, cfg, today || to);
    const paid = [], late = [];
    (state.contracts || []).forEach((c) => {
      (c.schedule || []).forEach((s) => {
        if (s.status !== 'paid' || !s.paidDate) return;
        if (from && s.paidDate < from) return;
        if (to && s.paidDate > to) return;
        paid.push(s);
        if (s.paidDate > s.tanggal) late.push(s);
      });
    });
    return {
      period: { from, to },
      income: inc,
      aum: m.AUM, ownerEquity: m.ownerEquity, deployed: m.deployed, liquid: m.liquid,
      investorLiab: m.investorLiab, regularLiab: m.regularLiab, flexLiab: m.flexLiab,
      leverage: m.leverage, roeBulan,
      roiAset: roiRealisasi, spread: spreadRealisasi, yieldRealisasi,
      adaPendapatan: inc.gross > 0.005,
      freeAttack: m.freeAttack, rrprActual: m.rrprActual, rrprRequired: m.rrprRequired,
      konsentrasi: conc.exposure,
      pembayaran: { total: paid.length, tepatWaktu: paid.length - late.length,
        onTimePct: paid.length ? R4((paid.length - late.length) / paid.length * 100) : null },
    };
  }

  // ── FINANCIAL STATEMENTS AS DATA ──────────────────────────────────────────
  // Pure numbers only, no HTML. The app and the scheduled PDF renderer both draw
  // from this, so a printed report can never disagree with the screen.
  function statements(state, cfg, from, to) {
    const A = (state.accounts || []);
    const per = (code) => balanceOf(state.ledger, state.accounts, code, { from, to });
    const asOf = (code) => balanceOf(state.ledger, state.accounts, code, { to });
    const byType = (t) => A.filter((a) => a.type === t);

    // Laba rugi: a true period
    const pendapatan = byType('pendapatan').map((a) => ({ code: a.code, name: a.name, amount: per(a.code) })).filter((r) => Math.abs(r.amount) > 0.005);
    const beban = byType('beban').map((a) => ({ code: a.code, name: a.name, amount: per(a.code) })).filter((r) => Math.abs(r.amount) > 0.005);
    const totalPendapatan = R4(pendapatan.reduce((s, r) => s + r.amount, 0));
    const totalBeban = R4(beban.reduce((s, r) => s + r.amount, 0));
    const labaBersih = R4(totalPendapatan - totalBeban);

    // Neraca: a point in time
    const aset = byType('aset').concat((state.pockets || []).map((p) => ({ code: p.code, name: p.nama, type: 'aset' })))
      .filter((a, i, arr) => arr.findIndex((x) => x.code === a.code) === i)
      .map((a) => ({ code: a.code, name: a.name, amount: asOf(a.code) })).filter((r) => Math.abs(r.amount) > 0.005)
      .sort((a, b) => (a.code < b.code ? -1 : 1));
    const liabilitas = byType('liabilitas').map((a) => ({ code: a.code, name: a.name, amount: asOf(a.code) })).filter((r) => Math.abs(r.amount) > 0.005);
    const ekuitasAkun = byType('ekuitas').map((a) => ({ code: a.code, name: a.name, amount: asOf(a.code) })).filter((r) => Math.abs(r.amount) > 0.005);
    const labaBerjalan = retainedProfit(state.ledger, state.accounts, to);
    const totalAset = R4(aset.reduce((s, r) => s + r.amount, 0));
    const totalLiab = R4(liabilitas.reduce((s, r) => s + r.amount, 0));
    const totalEkuitas = R4(ekuitasAkun.reduce((s, r) => s + r.amount, 0) + labaBerjalan);

    // Arus kas: cash movement per pocket within the period
    const pocketCodes = (state.pockets || []).map((p) => p.code);
    const arus = { operasi: [], investasi: [], pendanaan: [] };
    (state.ledger || []).forEach((e) => {
      if (from && e.tanggal < from) return;
      if (to && e.tanggal > to) return;
      const cashDelta = (e.lines || []).reduce((s, l) => s + (pocketCodes.indexOf(l.account) >= 0 ? (+l.debit || 0) - (+l.credit || 0) : 0), 0);
      if (Math.abs(cashDelta) < 0.005) return;
      const codes = (e.lines || []).map((l) => l.account);
      let bucket = 'operasi';
      if (codes.indexOf('1100') >= 0) bucket = 'investasi';
      else if (codes.some((c) => c === '2000' || c === '3000' || c === '3010')) bucket = 'pendanaan';
      arus[bucket].push({ date: e.tanggal, memo: e.memo, amount: R4(cashDelta) });
    });
    const arusTotal = { operasi: R4(arus.operasi.reduce((s, r) => s + r.amount, 0)),
      investasi: R4(arus.investasi.reduce((s, r) => s + r.amount, 0)),
      pendanaan: R4(arus.pendanaan.reduce((s, r) => s + r.amount, 0)) };
    arusTotal.bersih = R4(arusTotal.operasi + arusTotal.investasi + arusTotal.pendanaan);

    // Neraca saldo as of the period end
    const trial = A.concat((state.pockets || []).map((p) => ({ code: p.code, name: p.nama, type: 'aset', normal: 'D' })))
      .filter((a, i, arr) => arr.findIndex((x) => x.code === a.code) === i)
      .map((a) => { const bal = asOf(a.code); const normal = a.normal || 'D';
        return { code: a.code, name: a.name, debit: normal === 'D' ? Math.max(bal, 0) : Math.max(-bal, 0),
                 kredit: normal === 'K' ? Math.max(bal, 0) : Math.max(-bal, 0) }; })
      .filter((r) => r.debit > 0.005 || r.kredit > 0.005)
      .sort((a, b) => (a.code < b.code ? -1 : 1));
    const trialTotal = { debit: R4(trial.reduce((s, r) => s + r.debit, 0)), kredit: R4(trial.reduce((s, r) => s + r.kredit, 0)) };

    return {
      period: { from, to },
      labaRugi: { pendapatan, beban, totalPendapatan, totalBeban, labaBersih },
      neraca: { aset, liabilitas, ekuitas: ekuitasAkun, labaBerjalan, totalAset, totalLiab, totalEkuitas,
        balanced: Math.abs(totalAset - (totalLiab + totalEkuitas)) < 0.01 },
      arusKas: { detail: arus, total: arusTotal },
      neracaSaldo: { rows: trial, total: trialTotal, balanced: Math.abs(trialTotal.debit - trialTotal.kredit) < 0.01 },
    };
  }

  // ── opening-position validator ────────────────────────────────────────────
  function openingChecks(state) {
    const eq = (code) => balanceOf(state.ledger, state.accounts, code);
    const gde = eq('3000'), investor = eq('2000'), deployed = eq('1100');
    const rrprCash = pocketBal(state, POCKET.RRPR);
    const total = R4(deployed + rrprCash);
    const approx = (a, b) => Math.abs(R4(a) - R4(b)) < 0.005;
    return {
      gde: R4(gde), investor: R4(investor), deployed: R4(deployed), rrprCash: R4(rrprCash), total,
      checks: [
        { label: 'Modal Gde = 195,625', ok: approx(gde, 195.625), actual: R4(gde) },
        { label: 'Dana Investor = 177,65', ok: approx(investor, 177.65), actual: R4(investor) },
        { label: 'Deployed = 373,275', ok: approx(deployed, 373.275), actual: R4(deployed) },
        { label: 'Kas RRPR = 13,19', ok: approx(rrprCash, 13.19), actual: R4(rrprCash) },
        { label: 'Gde + Investor = Deployed', ok: approx(gde + investor, deployed), actual: R4(gde + investor) },
        { label: 'Total aset = 386,465', ok: approx(total, 386.465), actual: total },
      ],
    };
  }

  // ── SAFE CONCURRENT WRITES (app ↔ Telegram bot) ───────────────────────────
  // The whole fund lives in ONE Firestore document, so a naive whole-state write
  // from the app would silently erase anything the bot posted while the page was
  // open (and vice versa). Bot operations are deliberately narrow and additive:
  // append a balanced ledger entry, and/or flip a schedule row to paid. So a
  // merge is well-defined: union the ledgers by id, and let "paid" win.
  // Returns the merged state plus what it recovered, so the UI can say so.
  function mergeCloudOps(local, cloud) {
    if (!cloud) return { state: local, recovered: { entries: 0, schedules: 0 } };
    const out = Object.assign({}, local);
    let entries = 0, schedules = 0;

    // 1) ledger: keep every entry either side has (id-keyed, order by date)
    const seen = {};
    (local.ledger || []).forEach((e) => { seen[e.id] = true; });
    const extra = (cloud.ledger || []).filter((e) => e && e.id && !seen[e.id]);
    if (extra.length) {
      entries = extra.length;
      out.ledger = (local.ledger || []).concat(extra)
        .sort((a, b) => (a.tanggal < b.tanggal ? -1 : (a.tanggal > b.tanggal ? 1 : 0)));
    }

    // 2) investor schedules: a payment recorded anywhere is a payment. Never un-pay.
    const cloudC = {};
    (cloud.investorContracts || []).forEach((c) => { cloudC[c.id] = c; });
    out.investorContracts = (local.investorContracts || []).map((c) => {
      const cc = cloudC[c.id];
      if (!cc || !Array.isArray(cc.schedule) || !Array.isArray(c.schedule)) return c;
      let touched = false;
      const sched = c.schedule.map((s, i) => {
        const cs = cc.schedule[i];
        if (cs && cs.status === 'paid' && s.status !== 'paid') { touched = true; schedules++; return Object.assign({}, s, cs); }
        return s;
      });
      return touched ? Object.assign({}, c, { schedule: sched }) : c;
    });

    // 3) contracts the bot created that we have never seen
    const localIds = {};
    (local.investorContracts || []).forEach((c) => { localIds[c.id] = true; });
    const newC = (cloud.investorContracts || []).filter((c) => c && c.id && !localIds[c.id]);
    if (newC.length) out.investorContracts = out.investorContracts.concat(newC);

    // 4) PROJECTS. The PGM robot writes new opportunities straight to Firestore,
    //    so a whole-state save from an open tab would delete them. Adopt anything
    //    the cloud has that we lack — but never let a stale cloud copy downgrade a
    //    project we have already entered (aktif/selesai outrank tersedia).
    const rank = (s) => (s === 'selesai' ? 3 : (s === 'aktif' || s === 'terlambat') ? 2 : 1);
    const localP = {};
    (local.projects || []).forEach((p) => { if (p && p.id) localP[p.id] = true; });
    const newP = (cloud.projects || []).filter((p) => p && p.id && !localP[p.id]);
    if (newP.length) out.projects = (local.projects || []).concat(newP);

    // 5) additive side-records the bot/app may each hold
    const unionById = (a, b) => {
      const seenId = {}; const res = [];
      (a || []).concat(b || []).forEach((x) => {
        const k = x && (x.id || x.ts || JSON.stringify(x));
        if (k && seenId[k]) return; if (k) seenId[k] = true; res.push(x);
      });
      return res;
    };
    if ((cloud.bridges || []).length) out.bridges = unionById(local.bridges, cloud.bridges);
    if ((cloud.decisionLog || []).length) out.decisionLog = unionById(local.decisionLog, cloud.decisionLog);
    if ((cloud.investors || []).length) out.investors = unionById(local.investors, cloud.investors);

    return { state: out, recovered: { entries, schedules: schedules, contracts: newC.length, projects: newP.length } };
  }

  // ── idempotent migration to the unified capital model ─────────────────────
  // Additive + versioned. Never destroys S.investorContracts / S.external /
  // S.orgConfig.alokasi. Stable IDs => running twice changes nothing.
  const SCHEMA_VERSION = 4;
  // Rebuild the derived unified model deterministically each run. Anything the
  // engine derives (ids prefixed prov:/ctr:/alloc:) is regenerated from the
  // legacy sources so re-seeding (which replaces contract ids) can't leave stale
  // duplicates; any manually-added rows (other id prefixes) are preserved.
  function migrate(state) {
    const keepP = (state.capitalProviders || []).filter((x) => !/^prov:/.test(x.id));
    const keepC = (state.capitalContracts || []).filter((x) => !/^ctr:/.test(x.id));
    const keepA = (state.capitalAllocations || []).filter((x) => !/^alloc:/.test(x.id));
    const P = [], C = [], A = [];
    const upP = (obj) => { const i = P.findIndex((x) => x.id === obj.id); if (i >= 0) P[i] = Object.assign({}, P[i], obj); else P.push(obj); };

    // 1) owners (Gde + RRPR) as owner_equity providers
    upP({ id: 'prov:gde', name: 'Gde', classification: 'owner_equity', subtype: 'owner_gde', relatedParty: false, active: true });
    upP({ id: 'prov:rrpr', name: 'RRPR', classification: 'owner_equity', subtype: 'owner_rrpr', relatedParty: false, active: true });

    // 2) investor contracts → providers + contracts (fully rebuilt from source)
    (state.investorContracts || []).forEach((c) => {
      const flexible = !!c.flexible;
      const nameKey = (c.nama || 'inv').toLowerCase().split(/\s|\(/)[0]; // veda/laili/fuad/papa
      const provId = 'prov:' + nameKey;
      const subtype = flexible ? 'related_party_flexible' : 'regular';
      const dispName = flexible ? 'Papa — Investor Fleksibel Pihak Berelasi' : (nameKey.charAt(0).toUpperCase() + nameKey.slice(1));
      upP({ id: provId, name: dispName, classification: 'investor_debt', subtype, relatedParty: flexible, active: c.status !== 'selesai' });
      C.push({
        id: 'ctr:' + c.id, providerId: provId, principal: R4(c.pokok), ratePct: c.ratePct != null ? c.ratePct : 2,
        startDate: c.tanggalMulai, maturityDate: c.tanggalMaturity || null, flexible, noticeDays: flexible ? (c.noticeDays || 30) : null,
        withdrawalNotice: c.withdrawalNotice || null, schedule: c.schedule || [], status: c.status || 'aktif', legacyName: c.nama,
      });
    });

    // 3) project allocations from orgConfig.alokasi (name → provider, name → active projectId)
    (((state.orgConfig || {}).alokasi) || []).forEach((row) => {
      const proj = matchProject(state, row.proyek);
      const projId = proj ? (proj.id || proj.peminjam) : row.proyek;
      (row.sumber || []).forEach((src) => {
        const key = normName(src.s).split(/\s/)[0];
        A.push({
          id: 'alloc:' + normName(row.proyek) + ':' + key, providerId: 'prov:' + key, contractId: null,
          projectId: projId, amount: R4(src.j), allocatedAt: (state.orgConfig && state.orgConfig.seedDate) || null, status: 'active', projectName: row.proyek, sourceName: src.s,
        });
      });
    });

    state.capitalProviders = keepP.concat(P);
    state.capitalContracts = keepC.concat(C);
    state.capitalAllocations = keepA.concat(A);
    state.schemaVersion = SCHEMA_VERSION;
    return state;
  }
  function normName(s) { return String(s || '').toLowerCase().replace(/&/g, '').replace(/\s+/g, ' ').trim(); }
  function keyName(s) { return normName(s).replace(/\bpo\b/g, '').replace(/\bdan\b/g, '').replace(/\bvila\b/g, '').replace(/\s+/g, ' ').trim(); }
  // Match an allocation row to a project. Restrict to the ACTIVE project set so a
  // loose name can't collide with dozens of dead/legacy projects (the spec's
  // name-fragility warning). Exact-normalized match first, fuzzy only as fallback.
  function matchProject(state, name) {
    const active = (state.orgConfig && state.orgConfig.activeProjectNames) || [];
    const pool = (state.projects || []).filter((p) => !active.length || active.indexOf(p.peminjam) >= 0);
    const n = keyName(name);
    let hit = pool.find((p) => keyName(p.peminjam) === n);
    if (hit) return hit;
    return pool.find((p) => { const pn = keyName(p.peminjam); return pn.indexOf(n.split(' ')[0]) >= 0 || n.indexOf(pn.split(' ')[0]) >= 0; });
  }

  return {
    // utils
    R4, addDays, addMonths, daysBetween, resolveNumber, cfgOf, DEFAULT_CONFIG, SCHEMA_VERSION, POCKET,
    // ledger
    balanceOf, retainedProfit, totalLiquid, attackCash, pocketBal, freeCashByPocket,
    // events + scenarios
    investorObligations, papaCallEvents, projectInflows, buildEvents, sortEvents, projectScenario,
    obligationsWithin, cushion, requiredRRPR, safeAttackBudget, maturityLadder, concentration, paymentLadder,
    // recommendations
    returnWaterfall, fundingRecommendation, pickSourcesForDeal, guaranteeGate, maxSafeTicket, buildTieredSchedule, fundingNeed,
    // validation + metrics + migration
    validateAllocations, providerAvailable, hasPosted, metrics, openingChecks, migrate, mergeCloudOps, incomeBreakdown, deckMetrics, statements,
  };
});
