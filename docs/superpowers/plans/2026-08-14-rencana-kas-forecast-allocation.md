# Rencana Kas — Forecast-Driven Capital Allocation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline). Steps use `- [ ]` tracking. Pure engine in `treasury.js` (TDD, `node --test`), UI in `index.html`, deploy = git push to main.

**Goal:** Turn the known inflow/outflow calendar into an allocation recommendation: for money on hand (and for each incoming return), say how much is free to reinvest vs must be held for a specific upcoming obligation that no earlier inflow can cover.

**Architecture:** New pure functions in `treasury.js`: `cashForecast` (forward deterministic timeline + free/hold + binding obligation) and `allocateInflow` (per-inflow reinvest/hold + reason). Rewrite `returnWaterfall` to repay RRPR *borrowing* (never top-up-to-target) then defer hold logic to the forecast. UI: a "Rencana Kas" panel in Treasury + an auto recommendation on each Inbox return.

**Tech Stack:** vanilla JS UMD engine, Node test runner, single-file HTML app.

**Model (blessed by user):**
- Deployable cash = HUB(1000) + GDE(1010) + IDLE_INV(1030). Excludes RRPR(1020, benteng) and SINKING(1040, terkunci).
- Inflows = `projectInflows(state,cfg,'base',today)` (expected, net of Mas Hena), future only (date ≥ today).
- Outflows = `investorObligations(state,today)` (bagi hasil + pokok; Papa/owner excluded), overdue clamped to today.
- Free-to-deploy = max(0, min running balance over the forward timeline − operatingFloor). Hold = available − free.
- RRPR: returns repay only what was *borrowed* from RRPR (bridges); currently 0 → returns skip RRPR. Never menambal to target.
- Per-inflow: exclude that inflow, project forward from its date; if a breach appears with no other inflow covering it, hold the shortfall for that binding obligation; else reinvest all.

---

### Task 1: `cashForecast` engine

**Files:** Modify `treasury.js` (add fn + export), `test/treasury.test.js` (add tests).

- [ ] Step 1: Write failing tests `CF1..CF4`:
  - CF1: no events → free == available, hold == 0, binding == null.
  - CF2: outflow 10 at D+60, no inflow, available 4 → minBalance −6, free 0, hold 4 (all held), binding = that outflow.
  - CF3: outflow 10 at D+60 but inflow 8 at D+30 (available 4) → running: +8 →12, −10 →2; min 2; free 2, hold 2, binding = the outflow.
  - CF4: overdue outflow (date < today) clamped to today and still counted.
- [ ] Step 2: Run `node --test` → FAIL (cashForecast undefined).
- [ ] Step 3: Implement `cashForecast(state, cfg, today, opts)`:
  - available = pocketBal(HUB)+pocketBal(GDE)+pocketBal(IDLE_INV).
  - inflows = projectInflows(state,cfg,'base',today).filter(e=>e.date>=today).
  - outflows = investorObligations(state,today).map(clamp date to max(date,today)) (amount already negative).
  - events sorted by date; running balance from available; record {date,io,amount,label,balance}.
  - minBalance across [available, ...balances]; minDate; binding = outflow event at/producing the min.
  - floor = resolveNumber(cfg.operatingFloor,0); freeToDeploy = R4(max(0,minBalance−floor)); hold = R4(max(0,available−freeToDeploy)).
  - return {available,floor,events,minBalance,minDate,binding,freeToDeploy,hold}.
- [ ] Step 4: Run `node --test` → PASS. Add to exports.
- [ ] Step 5: Commit.

### Task 2: `allocateInflow` engine (per-inflow reinvest/hold)

**Files:** Modify `treasury.js`, `test/treasury.test.js`.

- [ ] Step 1: Failing tests `AI1..AI3`:
  - AI1: inflow 2.75 at D+0, next outflow 10 at D+60, NO other inflow, available 0 → hold min(2.75,10)=2.75, reinvest 0, forObligation=that outflow.
  - AI2: same but another inflow 11 at D+20 covers the 10 → reinvest 2.75, hold 0, forObligation null.
  - AI3: partial — outflow 2 at D+10, available 0, no other inflow, inflow 2.75 → hold 2, reinvest 0.75.
- [ ] Step 2: Run → FAIL.
- [ ] Step 3: Implement `allocateInflow(state, cfg, today, inflow)` where inflow={amount,date,label}:
  - Build events EXCLUDING one inflow matching inflow (by date+amount+label first hit).
  - Project forward from `available`; consider only points at date ≥ inflow.date; minAfter = min balance there.
  - shortfall = max(0, floor − minAfter); hold = R4(min(inflow.amount, shortfall)); reinvest = R4(inflow.amount − hold).
  - forObligation = the outflow at minAfter's date (or null if hold==0).
  - return {reinvest, hold, forObligation, available}.
- [ ] Step 4: Run → PASS. Export.
- [ ] Step 5: Commit.

### Task 3: `rrprBorrowed` + rewrite `returnWaterfall`

**Files:** Modify `treasury.js`, update existing returnWaterfall tests.

- [ ] Step 1: Tests `RW1..RW3`:
  - RW1: rrprBorrowed==0 when no bridges → waterfall has NO RRPR step even if RRPR below target.
  - RW2: with an RRPR bridge of 5 outstanding + incoming 8 → toRRPR=5 (repay), rest 3 flows on.
  - RW3: waterfall routes near-binding pokok to sinking, remainder to Gde; freeAttack matches cashForecast.freeToDeploy semantics.
- [ ] Step 2: Run → FAIL.
- [ ] Step 3: Implement `rrprBorrowed(state)` = sum outstanding RRPR bridges (`(state.bridges||[]).filter(b=>b.from===RRPR||b.pocket===RRPR||b.source==='RRPR').reduce(sum b.amount|b.jumlah)`), R4. Rewrite `returnWaterfall(state,cfg,amount,today)`: step1 repay min(rem,rrprBorrowed); step2 sinking for uncovered near pokok (use sinkingShortfall bounded to binding); step3 rest→Gde with ownerTrapped flag from cashForecast. Remove the top-up-to-target RRPR step.
- [ ] Step 4: Run `node --test` (all) → PASS. Update any now-stale returnWaterfall assertions.
- [ ] Step 5: Commit.

### Task 4: "Rencana Kas" panel (Treasury UI)

**Files:** Modify `index.html` (Treasury hub render).

- [ ] Step 1: Add `rRencanaKas()` returning a card: headline "Bebas diputar hari ini: Rp {free} · Tahan Rp {hold} buat {binding.label} ({tgl})"; then the forward timeline list (each event: tanggal · masuk/keluar · jumlah · saldo berjalan), min point highlighted. Conservative cross-check line "(versi hati-hati: Rp {safeAttackBudget})".
- [ ] Step 2: Insert into Treasury hub (`rTreasuryHub`) after the health/scenario section. Use `Treasury.cashForecast(engineState(),engineCfg(),todayISO())`.
- [ ] Step 3: Verify in browser (localhost real data): panel renders, numbers sane, no console error. Screenshot.
- [ ] Step 4: Commit.

### Task 5: Inbox per-inflow recommendation

**Files:** Modify `index.html` (`rKeuInbox` masuk branch; replace the sinking-only nudge).

- [ ] Step 1: For each `masuk` event, call `Treasury.allocateInflow(engineState(),engineCfg(),todayISO(),{amount:e.jumlah,date:e.tanggal,label:e.judul})`. Render: "💡 {fd(tgl)} {judul}: reinvest **Rp {reinvest}** atau tahan **Rp {hold}** untuk {forObligation.label} ({fd(forObligation.date)}) — tidak ada inflow lain sebelum itu." If hold==0 → "boleh diputar semua ke proyek baru." Keep "Masuk ke kantong Gde".
- [ ] Step 2: Verify in browser: the Ayam Petelor / Pelayaran returns show the concrete reinvest/hold line. Screenshot.
- [ ] Step 3: Commit.

### Task 6: Verify + deploy

- [ ] Step 1: `node --test` all green; inline-JS syntax check; no console errors on Treasury + Inbox.
- [ ] Step 2: Deploy (push remaining-features-20260810 → main), wait for Pages, verify engine live + panel on production (read-only), screenshot.
- [ ] Step 3: Update memory. Report.
