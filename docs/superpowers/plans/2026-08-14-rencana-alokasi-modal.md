# Rencana Alokasi Modal — Spec + Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]`. Engine work is TDD in `treasury.js` + `test/treasury.test.js` (`node --test`); UI in `index.html`. Deploy = push `remaining-features-20260810` → `main`, GitHub Pages Action, then verify on production.

**Goal:** When entering a project, the full capital-allocation plan is known up front — which pockets fund it, which future inflow covers which named investor obligation, and what changes for the other obligations — and the same calendar drives the reinvest/hold verdict when money actually arrives.

**Architecture:** One deterministic calendar in `treasury.js` feeds BOTH the deal sheet and Rencana Kas. Coverage matching is derived every render (never stored); only *facts* are persisted (RRPR bridge draws, the accepted verdict/mix snapshot at entry, manual overrides).

---

## Decisions (locked with the owner)

| # | Decision |
|---|---|
| D1 | Plan is **recomputed live**, plus a **snapshot of facts** stored at deal entry so drift is detectable. |
| D2 | **Conservative governs every promise** (verdict, hold amount, coverage). Optimistic shown only as "potensi". |
| D3 | **Papa = regular investor.** Bagi hasil Rp 1 jt on the 1st, 2026-09-01 … 2027-08-01 (12×, existing rows). Pokok Rp 50 jt on **2027-08-01**. `flexible` becomes false. |
| D4 | **RRPR may count** as proof that investors stay payable, **but must be flagged**: "AMAN, bersandar RRPR Rp X". |
| D5 | **Horizon = unbounded** (to the last known obligation). |
| D6 | Scope = fix everything that touches a number, then connect. |

## Matching rule (used everywhere)

Earliest-due obligation is covered by the earliest-arriving money. Same date → **pokok before bagi hasil**. An inflow is consumed at most once (no double-counting). Coverage is reported per obligation with the **real investor name** and per project.

## Confirmed defects to fix (9, all adversarially verified)

| ID | Defect | Site |
|---|---|---|
| F1 | Overdue investor obligations are dropped, so being late makes the fund look safer (Modal Serang 17,151 → 18,672) | `treasury.js` buildEvents ~216, obligationsWithin ~244, maturityLadder ~479 |
| F2 | `requiredRRPR` measured on a curve that already spends RRPR → collapses to 0, releases the fortress; also makes `settleBridges` clear an unpaid bridge | `treasury.js:252`, `index.html` settleBridges |
| F3 | `tersedia`/cancelled projects counted as future cash (name-only gate) | `index.html:512`, `:1480`, `:1984`, undoActivation |
| F4 | `returnWaterfall` double-counts the incoming payment (passes `date: today`) | `treasury.js` returnWaterfall |
| F5 | `bridges` never reach the engine + shape mismatch → `repayRRPR` structurally 0 | `index.html` engineState, confirmMasuk; `treasury.js` rrprBorrowed |
| F6 | Rencana Kas stacks two non-comparable numbers; says "tidak perlu ditahan" when cash is 0 but the forward balance is short | `index.html` rRencanaKas |
| F7 | Every obligation row is labelled "Investor" (migrate writes `legacyName`, reader wants `nama`) | `treasury.js:1210` / `:154` |
| F8 | Papa modelled two ways (gate assumes a 12,5 call; forecast shows nothing) | resolved by D3 |
| F9 | Same-day ordering / overdue handling differs between the two engines | unified in Phase B |

---

## Phase A — Fondasi (numbers must be right first)

### A1: Overdue obligations stop vanishing

**Files:** `treasury.js` (buildEvents, obligationsWithin, maturityLadder), `test/treasury.test.js`

- [ ] Write failing tests: `OV1` an obligation dated before today still appears in `buildEvents` (clamped to today, `overdue:true`); `OV2` `obligationsWithin(...,30,...)` includes it; `OV3` `safeAttackBudget` does NOT increase when a due payment goes unpaid; `OV4` a late project inflow is still excluded (a late borrower is not cash).
- [ ] Run `node --test` → FAIL.
- [ ] Implement: in `buildEvents`, clamp obligations (`investorObligations` + `papaCallEvents`) with `.map(e => e.date < today ? {...e, date: today, overdue: true} : e)` and keep `projectInflows(...).filter(e => e.date >= today)`; `obligationsWithin` `d >= 0 && d <= days` → `d <= days`; `maturityLadder` `inRange` `x >= 0 && x <= h` → `x <= h`.
- [ ] Run `node --test` → PASS. Commit.

### A2: requiredRRPR stops collapsing

**Files:** `treasury.js:252`, `test/treasury.test.js`

- [ ] Write failing test `RR1`: on a fixed book, `requiredRRPR` returns the SAME number whether the RRPR pocket holds 0, 13,19 or 60 (invariant to its own balance).
- [ ] Run → FAIL.
- [ ] Implement: `const gap = Math.max(0, pocketBal(state, POCKET.RRPR) - stress.minCash);` (was `Math.max(0, -stress.minCash)`).
- [ ] Run all tests → PASS (test:335 is self-referential and must still pass). Commit.

### A3: Only entered projects count as cash

**Files:** `index.html:512, 1480, 1984, undoActivation`, `test` (engine unaffected)

- [ ] Add `&& p.status!=='tersedia'` to the three name-gated filters.
- [ ] `undoActivation` removes the name from `orgConfig.activeProjectNames` (mirror `undoEnterDeal`).
- [ ] Verify in the browser on real data: engine still sees exactly the 4 active projects; then add a temporary in-memory `tersedia` twin and confirm it is NOT counted. Commit.

### A4: returnWaterfall stops double-counting

**Files:** `treasury.js` returnWaterfall, `test/treasury.test.js`

- [ ] Write failing test `RW4`: a scheduled return of 89,775 dated 2026-08-30 passed to `returnWaterfall` must produce the same hold/reinvest as `allocateInflow` with that same date (currently differs by ~69,55).
- [ ] Run → FAIL.
- [ ] Implement: `returnWaterfall(state, cfg, amount, today, opts)` takes the inflow's real `date`/`label` and forwards them to `allocateInflow`; `tWaterfall` in `index.html` passes a date input (default today).
- [ ] Run → PASS. Commit.

### A5: RRPR bridges reach the engine

**Files:** `index.html` engineState + confirmMasuk + settleBridges, `treasury.js` rrprBorrowed, tests

- [ ] Write failing test `BR1`: a bridge `{id, from:'1020', amount:5, dealId, restoreBy, settled:false}` is seen by `rrprBorrowed`; `BR2` a settled one is not.
- [ ] Implement: `engineState()` passes `bridges: S.bridges||[]`; `confirmMasuk` writes the unified shape (`{id, from:'1020', amount, dealId, restoreBy, settled:false}`); `rrprBorrowed` reads `from`; `settleBridges` marks `settled:true` only when RRPR is genuinely back at its (now-correct) floor.
- [ ] Migration for any legacy bridge rows: add `from:'1020'` when missing. Commit.

### A6: Rencana Kas tells the truth

**Files:** `index.html` rRencanaKas

- [ ] Same-basis numbers: headline and the cross-check must state their basis in words ("sampai kewajiban terakhir" vs "30 hari"), and the conservative figure is the one labelled as governing.
- [ ] When `hold` is 0 because cash is 0, show the shortfall instead: `kurang = max(0, floor - minBalance)` → "Kas habis — kas ke depan masih kurang Rp X di <tanggal>", amber.
- [ ] Verify in browser + screenshot. Commit.

### A7: Real investor names everywhere

**Files:** `treasury.js` migrate (~1210) / investorObligations (~154), tests

- [ ] Write failing test `NM1`: `investorObligations` on a migrated state returns labels containing the real investor name, not "Investor".
- [ ] Implement: migrate writes `nama` (keep `legacyName` for compatibility).
- [ ] Run → PASS. Commit.

### A8: Papa becomes a regular investor

**Files:** `index.html` (one-time idempotent migration), tests

- [ ] Write failing test `PA1`: a contract with `flexible:true` and no pokok row, once migrated, has `flexible:false`, a pokok row of 50 on 2027-08-01, and 12 bagi hasil rows; running twice changes nothing.
- [ ] Implement `fixPapaContract()` in the migration chain: set `flexible:false`, `tenorBulan:12`, `tanggalMaturity:'2027-08-01'`, append the pokok row if absent. Idempotent, merge-safe.
- [ ] Verify on real data: Papa appears in the forecast and in the obligations list; totals move as expected. Commit + deploy Phase A.

## Phase B — One calendar

- [ ] `fundCalendar(state, cfg, today, {scenario, deal})` in `treasury.js`: single source for events + running balance + binding + free/hold, parameterised by scenario, unbounded horizon, obligations clamped, inflows filtered. `cashForecast` becomes a thin wrapper (`scenario:'conservative'` governs; `'base'` for the potensi figure).
- [ ] Verdict carries `dependsOnRRPR` (how much of the proof leans on the fortress).
- [ ] Tests: same book, same numbers from both entry points; RRPR dependence reported.
- [ ] Rencana Kas + deal sheet both read it. Commit.

## Phase C — Coverage plan at deal entry

- [ ] `coveragePlan(state, cfg, today, {deal})` → `[{obligation:{name,date,amount,tipe}, covered:[{from,date,amount}], shortfall}]` using the matching rule; each inflow consumed once.
- [ ] `coverageDelta(before, after)` → which obligations changed status because of this deal.
- [ ] Tests incl. no-double-count and same-day pokok priority.
- [ ] Deal sheet UI: modal source, coverage list (real names), ripple list, RRPR flag, and the advisory "dibutuhkan Rp X sebelum <tanggal>". Commit.

## Phase D — Snapshot + drift

- [ ] On confirm, store `S.plans[]` `{id, dealId, tanggal, verdict, mix, coverage, dependsOnRRPR}` — facts only; union-by-id in `mergeCloudOps`; never rebuilt.
- [ ] Compare live vs snapshot; badge differences on the project + in Rencana Kas.
- [ ] Tests: snapshot survives a cloud merge; drift detected. Commit.

## Phase E — Inbox reads the same plan

- [ ] `allocateInflow` delegates to `fundCalendar`; the hold line names the obligation it protects, matching the deal-entry plan.
- [ ] Tests: Inbox verdict == deal-sheet plan for the same money. Commit.

## Phase F — Verify + ship

- [ ] Full `node --test`, inline-JS syntax check, no console errors on Treasury/Inbox/Proyek.
- [ ] Adversarial review workflow over the whole diff; fix confirmed findings.
- [ ] Deploy, verify on production (read-only), screenshot, update memory.
