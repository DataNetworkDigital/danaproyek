# Smart Deal Intake + Investor-Payment Guarantee — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a borrower deal arrives from PGM, DanaTrack recommends which cash pockets fund it and proves every investor bagi hasil + pokok stays payable on its own date before Gde confirms.

**Architecture:** Two separate pure functions in `treasury.js` — `pickSourcesForDeal()` proposes a pocket mix via a floor-respecting waterfall, `guaranteeGate()` vetoes it using a dated forward stress ladder built from `S.investorContracts` schedules. UI lives in `index.html`: Peluang becomes a segment of the Proyek tab, and a detail sheet → dry-run → decision screen → confirm → undo flow drives `enterDeal()`. All money math is pure and unit-tested; only `enterDeal()` mutates state.

**Tech Stack:** Vanilla JS (no framework, no build), `treasury.js` UMD module, Node built-in test runner (`node --test`), existing clay/neumorphic CSS in `index.html`.

**Spec:** `docs/superpowers/specs/2026-08-03-smart-deal-intake-treasury-design.md`

**Branch:** `smart-intake-20260803` (already created, spec committed)

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `treasury.js` | Pure engine. Adds funding waterfall, payment ladder, guarantee verdict, max-safe-ticket, tiered schedule. No DOM. | Modify |
| `test/treasury.test.js` | Node tests for every engine function. | Modify (append) |
| `index.html` | Config migration, engine adapters, Peluang UI, decision flow, `enterDeal`/`undoEnterDeal` postings. | Modify |

Existing exports and behavior must not change — only additions. The 18 existing tests must keep passing after every task.

---

## Conventions used throughout

- Money unit is **juta rupiah (jt)**, dates are `'YYYY-MM-DD'` strings.
- `R4(x)` rounds to 4 decimals; use it on every computed money value.
- Pocket codes: `1000` Utama (hub), `1010` Gde, `1020` RRPR, `1030` Investor Belum Dialokasikan, `1040` Investor Jatuh Tempo (LOCKED).
- Run all tests with `node --test` from `/Users/gdedharma_/fund-tracker`.
- Syntax-check `index.html` after each UI task with:
  ```bash
  ST=$(grep -n '^<script>$' index.html | tail -1 | cut -d: -f1); EN=$(grep -n '^</script>$' index.html | tail -1 | cut -d: -f1); sed -n "$((ST+1)),$((EN-1))p" index.html > /tmp/app.js && node --check /tmp/app.js && echo "SYNTAX OK"
  ```

---

### Task 1: Config defaults + `addMonths` + `freeCashByPocket`

Per-pocket spendable cash. The locked sinking pocket is always 0, and idle investor money is netted against obligations due inside the guarantee window so dry powder can never cannibalize a near maturity.

**Files:**
- Modify: `treasury.js` (DEFAULT_CONFIG block ~line 30, cfgOf ~line 48, helpers near `addDays`)
- Test: `test/treasury.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `test/treasury.test.js`:

```js
// ── Task 1: config + addMonths + freeCashByPocket ───────────────────────────
test('T1a. addMonths handles month-end clamping', () => {
  assert.strictEqual(T.addMonths('2026-01-31', 1), '2026-02-28');
  assert.strictEqual(T.addMonths('2026-08-03', 5), '2027-01-03');
  assert.strictEqual(T.addMonths('2026-12-15', 1), '2027-01-15');
});

test('T1b. config exposes funding order, window, tiered return defaults', () => {
  const cfg = T.cfgOf({});
  assert.deepStrictEqual(cfg.fundingOrder, ['1030', '1010', '1020']);
  assert.strictEqual(cfg.hardGuaranteeWindowDays, 60);
  assert.strictEqual(cfg.timingBufferDays, 7);
  assert.strictEqual(cfg.tieredReturn.m1_3, 5.5);
  assert.strictEqual(cfg.tieredReturn.m4_6, 6.5);
  assert.strictEqual(cfg.tieredReturn.cycleMonths, 6);
  assert.strictEqual(cfg.tieredReturn.feePct, 0.5);
  assert.strictEqual(cfg.ownerCashTrap, true);
});

test('T1c. freeCash: sinking locked at 0, idle netted of window earmarks, RRPR floored', () => {
  const st = S({
    ledger: [
      entry('2026-08-01', [dr('1010', 40), cr('3000', 40)]),   // Gde 40
      entry('2026-08-01', [dr('1030', 30), cr('2000', 30)]),   // idle investor 30
      entry('2026-08-01', [dr('1020', 20), cr('3010', 20)]),   // RRPR 20
      entry('2026-08-01', [dr('1040', 15), cr('2000', 15)]),   // sinking 15
    ],
    providers: [{ id: 'p1', classification: 'investor_debt', subtype: 'regular' }],
    contracts: [{ id: 'c1', providerId: 'p1', principal: 30, schedule: [
      { tanggal: '2026-09-01', jumlah: 12, tipe: 'pokok', status: 'pending' },
    ] }],
  });
  const cfg = T.cfgOf({});
  const free = T.freeCashByPocket(st, cfg, TODAY);
  assert.strictEqual(free['1040'], 0, 'sinking pocket is never spendable');
  assert.strictEqual(free['1010'], 40, 'Gde capital fully available');
  // 12 due inside 60d window, 15 already staged in sinking -> nothing left to earmark
  assert.strictEqual(free['1030'], 30, 'earmark already covered by sinking');
  assert.strictEqual(free['1020'], T.R4(20 - T.requiredRRPR(st, cfg, TODAY)), 'RRPR only above its floor');
});

test('T1d. freeCash: idle investor is netted when sinking does not cover the window', () => {
  const st = S({
    ledger: [entry('2026-08-01', [dr('1030', 30), cr('2000', 30)])],
    providers: [{ id: 'p1', classification: 'investor_debt', subtype: 'regular' }],
    contracts: [{ id: 'c1', providerId: 'p1', principal: 30, schedule: [
      { tanggal: '2026-09-01', jumlah: 20, tipe: 'pokok', status: 'pending' },
    ] }],
  });
  const free = T.freeCashByPocket(st, T.cfgOf({}), TODAY);
  assert.strictEqual(free['1030'], 10, '30 idle minus 20 promised inside the window');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: `# fail 4` (functions not defined).

- [ ] **Step 3: Add `addMonths` helper**

In `treasury.js`, immediately after the `addDays` function:

```js
  function addMonths(s, n) {
    const [y, m, d] = String(s).split('-').map(Number);
    const target = new Date(Date.UTC(y, m - 1 + n, 1));
    const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    return isoOf(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(d, lastDay)));
  }
```

- [ ] **Step 4: Extend `DEFAULT_CONFIG`**

In `treasury.js`, inside `DEFAULT_CONFIG`, after `investorRatePct: 2,` add:

```js
    fundingOrder: ['1030', '1010', '1020'],   // idle investor -> Gde -> RRPR (bridge only)
    operatingFloor: 0,                        // cash kept in Utama as transit float
    hardGuaranteeWindowDays: 60,              // window we pre-fund and net earmarks against
    timingBufferDays: 7,                      // inflows assumed this late; also sizes minBuffer
    singleBorrowerCapPct: 40,                 // warn when one deal exceeds this % of liquid cash
    ownerCashTrap: true,                      // suppress owner draw while forward buffer is thin
    tieredReturn: { m1_3: 5.5, m4_6: 6.5, cycleMonths: 6, feePct: 0.5 },
```

- [ ] **Step 5: Surface the new keys in `cfgOf`**

In `treasury.js`, inside the object `cfgOf` returns, after the `investorRatePct` line add:

```js
      fundingOrder: t.fundingOrder || DEFAULT_CONFIG.fundingOrder,
      operatingFloor: t.operatingFloor != null ? t.operatingFloor : DEFAULT_CONFIG.operatingFloor,
      hardGuaranteeWindowDays: t.hardGuaranteeWindowDays != null ? t.hardGuaranteeWindowDays : DEFAULT_CONFIG.hardGuaranteeWindowDays,
      timingBufferDays: t.timingBufferDays != null ? t.timingBufferDays : DEFAULT_CONFIG.timingBufferDays,
      singleBorrowerCapPct: t.singleBorrowerCapPct != null ? t.singleBorrowerCapPct : DEFAULT_CONFIG.singleBorrowerCapPct,
      ownerCashTrap: t.ownerCashTrap != null ? t.ownerCashTrap : DEFAULT_CONFIG.ownerCashTrap,
      tieredReturn: Object.assign({}, DEFAULT_CONFIG.tieredReturn, t.tieredReturn),
```

- [ ] **Step 6: Implement `freeCashByPocket`**

In `treasury.js`, after the `requiredRRPR` function:

```js
  // Spendable cash per pocket, after floors and earmarks.
  // 1040 (sinking) is structurally un-spendable: the moment it can fund a deal,
  // the principal guarantee is fiction.
  function freeCashByPocket(state, cfg, today) {
    const windowEnd = addDays(today, cfg.hardGuaranteeWindowDays);
    const dueInWindow = investorObligations(state, today)
      .filter((e) => e.date <= windowEnd)
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
```

- [ ] **Step 7: Export the new functions**

In the `return { ... }` block at the bottom of `treasury.js`, change the utils line to include `addMonths` and add `freeCashByPocket` to the ledger line:

```js
    // utils
    R4, addDays, addMonths, daysBetween, resolveNumber, cfgOf, DEFAULT_CONFIG, SCHEMA_VERSION, POCKET,
    // ledger
    balanceOf, retainedProfit, totalLiquid, attackCash, pocketBal, freeCashByPocket,
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `node --test 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: `# fail 0`, `# pass 22`.

- [ ] **Step 9: Commit**

```bash
git add treasury.js test/treasury.test.js
git commit -m "Engine: funding config, addMonths, freeCashByPocket (sinking locked, idle netted)"
```

---

### Task 2: `pickSourcesForDeal` — the funding waterfall

Draws the ticket across pockets in configured order, each down to its floor. RRPR draws are flagged as bridges with a restore-by date. Never touches `1040`.

**Files:**
- Modify: `treasury.js` (after `freeCashByPocket`)
- Test: `test/treasury.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// ── Task 2: pickSourcesForDeal ──────────────────────────────────────────────
function fundedState() {
  return S({
    ledger: [
      entry('2026-08-01', [dr('1030', 20), cr('2000', 20)]),
      entry('2026-08-01', [dr('1010', 30), cr('3000', 30)]),
      entry('2026-08-01', [dr('1020', 25), cr('3010', 25)]),
      entry('2026-08-01', [dr('1040', 10), cr('2000', 10)]),
    ],
  });
}

test('T2a. draws idle investor first, then Gde, never the sinking pocket', () => {
  const st = fundedState(), cfg = T.cfgOf({});
  const r = T.pickSourcesForDeal(st, cfg, { ticket: 45, maturityDate: '2026-12-01' });
  assert.strictEqual(r.mix.length, 2);
  assert.deepStrictEqual(r.mix[0], { code: '1030', amount: 20, bridge: false, restoreBy: null });
  assert.strictEqual(r.mix[1].code, '1010');
  assert.strictEqual(r.mix[1].amount, 25);
  assert.strictEqual(r.shortfall, 0);
  assert.ok(!r.mix.some((m) => m.code === '1040'), 'sinking pocket never used');
});

test('T2b. RRPR is a flagged bridge with a restore-by date, used only last', () => {
  const st = fundedState(), cfg = T.cfgOf({});
  const r = T.pickSourcesForDeal(st, cfg, { ticket: 60, maturityDate: '2026-12-01' });
  const rrpr = r.mix.find((m) => m.code === '1020');
  assert.ok(rrpr, 'RRPR used once cheaper sources are exhausted');
  assert.strictEqual(rrpr.bridge, true);
  assert.strictEqual(rrpr.restoreBy, '2026-12-01', 'restore-by is the deal maturity, never an assumed raise');
  assert.strictEqual(r.usesBridge, true);
});

test('T2c. reports shortfall when every source is exhausted', () => {
  const st = fundedState(), cfg = T.cfgOf({});
  const r = T.pickSourcesForDeal(st, cfg, { ticket: 500, maturityDate: '2026-12-01' });
  const funded = T.R4(r.mix.reduce((s, m) => s + m.amount, 0));
  assert.strictEqual(T.R4(funded + r.shortfall), 500, 'funded + shortfall = ticket');
  assert.ok(r.shortfall > 0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: `# fail 3`.

- [ ] **Step 3: Implement `pickSourcesForDeal`**

In `treasury.js`, after `freeCashByPocket`:

```js
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
```

- [ ] **Step 4: Export it**

Add `pickSourcesForDeal` to the recommendations line of the export block:

```js
    // recommendations
    returnWaterfall, fundingRecommendation, pickSourcesForDeal,
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: `# fail 0`, `# pass 25`.

- [ ] **Step 6: Commit**

```bash
git add treasury.js test/treasury.test.js
git commit -m "Engine: pickSourcesForDeal waterfall with RRPR bridge flagging"
```

---

### Task 3: `paymentLadder` — dated proof every investor gets paid

The heart of the guarantee. Walks every future investor obligation date and checks cash-on-hand at that date, with project inflows shifted late and the proposed deal applied.

**Files:**
- Modify: `treasury.js` (after `pickSourcesForDeal`)
- Test: `test/treasury.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// ── Task 3: paymentLadder ───────────────────────────────────────────────────
function ladderState() {
  return S({
    ledger: [entry('2026-08-01', [dr('1010', 30), cr('3000', 30)])], // 30 liquid
    providers: [{ id: 'p1', classification: 'investor_debt', subtype: 'regular' }],
    contracts: [{ id: 'c1', providerId: 'p1', principal: 50, nama: 'Investor A', schedule: [
      { tanggal: '2026-09-03', jumlah: 1, tipe: 'bagihasil', status: 'pending' },
      { tanggal: '2026-10-03', jumlah: 1, tipe: 'bagihasil', status: 'pending' },
      { tanggal: '2026-11-03', jumlah: 50, tipe: 'pokok', status: 'pending' },
    ] }],
    projects: [{ id: 'pr1', name: 'Proyek Lama', deploy: 40, type: 'onetime', profit: 6,
      principalDate: '2026-10-20', inflowQuality: 'contracted' }],
  });
}

test('T3a. ladder has one row per investor obligation, in date order', () => {
  const l = T.paymentLadder(ladderState(), T.cfgOf({}), TODAY, {});
  const dates = l.rows.map((r) => r.date);
  assert.deepStrictEqual(dates, ['2026-09-03', '2026-10-03', '2026-11-03']);
  assert.strictEqual(l.rows[2].kind, 'inv_principal');
  assert.strictEqual(l.rows[2].obligation, 50);
});

test('T3b. cumulative cash counts stressed inflows only after their delayed date', () => {
  const l = T.paymentLadder(ladderState(), T.cfgOf({}), TODAY, {});
  // 30 cash - 1 = 29 at Sep 3 (project inflow lands Oct 20 +7d = Oct 27, later)
  assert.strictEqual(l.rows[0].cumulativeCash, 29);
  assert.strictEqual(l.rows[1].cumulativeCash, 28);
  // Nov 3: inflow 46 * 0.7 (contracted haircut) = 32.2 has landed by Oct 27
  assert.strictEqual(l.rows[2].cumulativeCash, T.R4(28 + 32.2 - 50));
});

test('T3c. applying a deal removes cash now and adds its inflow later', () => {
  const st = ladderState(), cfg = T.cfgOf({});
  const base = T.paymentLadder(st, cfg, TODAY, {});
  const withDeal = T.paymentLadder(st, cfg, TODAY, {
    deal: { ticket: 20, profit: 3, maturityDate: '2026-12-15', inflowQuality: 'contracted' },
    mix: [{ code: '1010', amount: 20 }],
  });
  assert.strictEqual(withDeal.rows[0].cumulativeCash, T.R4(base.rows[0].cumulativeCash - 20),
    'deal cash leaves immediately');
  assert.ok(withDeal.rows[2].cumulativeCash < base.rows[2].cumulativeCash,
    'deal inflow lands after the Nov obligation, so it does not help that date');
});

test('T3d. minBuffer is derived from near-term daily obligation outflow', () => {
  const l = T.paymentLadder(ladderState(), T.cfgOf({}), TODAY, {});
  assert.ok(l.minBuffer >= 0);
  assert.strictEqual(typeof l.minGap, 'number');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: `# fail 4`.

- [ ] **Step 3: Implement `paymentLadder`**

In `treasury.js`, after `pickSourcesForDeal`:

```js
  // The guarantee proof. For each dated investor obligation, project cash-on-hand
  // at that date under stress (inflows late + haircut). All pockets count as payable
  // here: RRPR and the sinking fund exist precisely to pay investors.
  function paymentLadder(state, cfg, today, opts) {
    opts = opts || {};
    const shift = cfg.timingBufferDays;
    const qual = cfg.inflowQuality.conservative;

    const obligations = [].concat(
      investorObligations(state, today),
      papaCallEvents(state, cfg, 'conservative', today)
    ).filter((e) => e.date >= today).sort((a, b) => (a.date < b.date ? -1 : 1));

    const inflows = projectInflows(state, cfg, 'conservative', today).slice();
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
      const landed = inflows.filter((i) => i.date <= o.date).reduce((s, i) => s + i.amount, 0);
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
```

- [ ] **Step 4: Export it**

Add to the events line of the export block:

```js
    obligationsWithin, cushion, requiredRRPR, safeAttackBudget, maturityLadder, concentration, paymentLadder,
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: `# fail 0`, `# pass 29`.

- [ ] **Step 6: Commit**

```bash
git add treasury.js test/treasury.test.js
git commit -m "Engine: paymentLadder, per-date investor payability proof"
```

---

### Task 4: `guaranteeGate` + `maxSafeTicket`

Turns the ladder into one plain verdict, and finds the largest ticket that still keeps every date safe.

**Files:**
- Modify: `treasury.js` (after `paymentLadder`)
- Test: `test/treasury.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// ── Task 4: guaranteeGate + maxSafeTicket ───────────────────────────────────
test('T4a. GREEN when every obligation date stays covered', () => {
  const st = S({
    ledger: [entry('2026-08-01', [dr('1010', 100), cr('3000', 100)])],
    providers: [{ id: 'p1', classification: 'investor_debt', subtype: 'regular' }],
    contracts: [{ id: 'c1', providerId: 'p1', principal: 10, nama: 'Investor A', schedule: [
      { tanggal: '2026-09-03', jumlah: 0.2, tipe: 'bagihasil', status: 'pending' },
    ] }],
  });
  const g = T.guaranteeGate(st, T.cfgOf({}), { ticket: 5, maturityDate: '2026-12-01' },
    [{ code: '1010', amount: 5 }], TODAY);
  assert.strictEqual(g.verdict, 'GREEN');
  assert.strictEqual(g.firstBreach, null);
});

test('T4b. RED names the exact obligation and date that breaks', () => {
  const st = ladderState();
  const g = T.guaranteeGate(st, T.cfgOf({}), { ticket: 25, profit: 3, maturityDate: '2026-12-20' },
    [{ code: '1010', amount: 25 }], TODAY);
  assert.strictEqual(g.verdict, 'RED');
  assert.strictEqual(g.firstBreach.date, '2026-11-03');
  assert.ok(/Investor A/.test(g.firstBreach.label));
  assert.ok(/2026-11-03|3 Nov/.test(g.reason) || g.reason.length > 0);
});

test('T4c. YELLOW when an RRPR bridge is used even though all dates are covered', () => {
  const st = S({
    ledger: [entry('2026-08-01', [dr('1020', 100), cr('3010', 100)])],
    providers: [], contracts: [],
  });
  const g = T.guaranteeGate(st, T.cfgOf({}), { ticket: 5, maturityDate: '2026-12-01' },
    [{ code: '1020', amount: 5, bridge: true, restoreBy: '2026-12-01' }], TODAY);
  assert.strictEqual(g.verdict, 'YELLOW');
  assert.ok(/cadangan|RRPR/i.test(g.reason));
});

test('T4d. maxSafeTicket finds the largest non-breaching ticket', () => {
  const st = ladderState(), cfg = T.cfgOf({});
  const full = T.guaranteeGate(st, cfg, { ticket: 25, profit: 0, maturityDate: '2026-12-20' },
    [{ code: '1010', amount: 25 }], TODAY);
  assert.strictEqual(full.verdict, 'RED');
  const best = T.maxSafeTicket(st, cfg, { profit: 0, maturityDate: '2026-12-20' }, TODAY);
  assert.ok(best.ticket >= 0 && best.ticket < 25, 'downsized below the breaking ticket');
  const check = T.guaranteeGate(st, cfg, { ticket: best.ticket, profit: 0, maturityDate: '2026-12-20' },
    T.pickSourcesForDeal(st, cfg, { ticket: best.ticket, maturityDate: '2026-12-20', today: TODAY }).mix, TODAY);
  assert.notStrictEqual(check.verdict, 'RED', 'the recommended max ticket is actually safe');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: `# fail 4`.

- [ ] **Step 3: Implement `guaranteeGate`**

In `treasury.js`, after `paymentLadder`:

```js
  // One plain verdict from the ladder. RED = a dated payment breaks; YELLOW = covered
  // but thin, bridged, or concentrated; GREEN = safe with buffer to spare.
  function guaranteeGate(state, cfg, deal, mix, today) {
    const ladder = paymentLadder(state, cfg, today, { deal: deal, mix: mix });
    const usesBridge = (mix || []).some((m) => m.bridge);
    const liquid = totalLiquid(state);
    const exposurePct = liquid > 0 ? R4(R4(deal.ticket) / liquid * 100) : 0;
    const overConcentrated = exposurePct > cfg.singleBorrowerCapPct;

    if (ladder.firstBreach) {
      return {
        verdict: 'RED', ladder, exposurePct, usesBridge,
        firstBreach: ladder.firstBreach,
        reason: 'Kewajiban ' + ladder.firstBreach.label + ' pada ' + ladder.firstBreach.date + ' tidak tertutup.',
      };
    }
    const reasons = [];
    if (ladder.minGap < ladder.minBuffer) reasons.push('sisa kas menipis di salah satu tanggal');
    if (usesBridge) reasons.push('memakai cadangan RRPR (harus dikembalikan)');
    if (overConcentrated) reasons.push('proyek ini ' + exposurePct + '% dari kas likuid');
    if (reasons.length) {
      return { verdict: 'YELLOW', ladder, exposurePct, usesBridge, firstBreach: null,
        reason: reasons.join('; ') + '.' };
    }
    const lastDate = ladder.rows.length ? ladder.rows[ladder.rows.length - 1].date : null;
    return { verdict: 'GREEN', ladder, exposurePct, usesBridge, firstBreach: null,
      reason: lastDate ? 'Semua kewajiban investor tertutup sampai ' + lastDate + '.' : 'Tidak ada kewajiban investor terjadwal.' };
  }
```

- [ ] **Step 4: Implement `maxSafeTicket`**

Immediately after `guaranteeGate`:

```js
  // Largest ticket that still passes the gate. Min-gap is monotonic in ticket,
  // so a bisection converges quickly. Returns the ticket plus why the full one failed.
  function maxSafeTicket(state, cfg, deal, today) {
    const fullTicket = R4(deal.ticket || totalLiquid(state));
    const test = (t) => {
      if (t <= 0) return true;
      const d = Object.assign({}, deal, { ticket: t, today: today });
      const mix = pickSourcesForDeal(state, cfg, d).mix;
      return guaranteeGate(state, cfg, d, mix, today).verdict !== 'RED';
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
```

- [ ] **Step 5: Export both**

Add to the recommendations line:

```js
    returnWaterfall, fundingRecommendation, pickSourcesForDeal, guaranteeGate, maxSafeTicket,
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `node --test 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: `# fail 0`, `# pass 33`.

- [ ] **Step 7: Commit**

```bash
git add treasury.js test/treasury.test.js
git commit -m "Engine: guaranteeGate verdict + maxSafeTicket downsizing"
```

---

### Task 5: `buildTieredSchedule` — 5.5% / 6.5% return ladder

**Files:**
- Modify: `treasury.js` (after `maxSafeTicket`)
- Test: `test/treasury.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// ── Task 5: tiered return schedule ──────────────────────────────────────────
test('T5a. months 1-3 use 5.5%, months 4-6 use 6.5%, net of the 0.5% fee', () => {
  const cfg = T.cfgOf({});
  const sch = T.buildTieredSchedule(100, '2026-08-03', 6, cfg.tieredReturn);
  assert.strictEqual(sch.length, 6);
  assert.strictEqual(sch[0].date, '2026-09-03');
  assert.strictEqual(sch[0].ratePct, 5.5);
  assert.strictEqual(sch[0].gross, 5.5);
  assert.strictEqual(sch[0].fee, 0.5);
  assert.strictEqual(sch[0].amount, 5, 'net = gross - fee');
  assert.strictEqual(sch[2].ratePct, 5.5);
  assert.strictEqual(sch[3].ratePct, 6.5, 'month 4 steps up');
  assert.strictEqual(sch[5].ratePct, 6.5);
});

test('T5b. the tier cycle resets every 6 months', () => {
  const sch = T.buildTieredSchedule(100, '2026-08-03', 9, T.cfgOf({}).tieredReturn);
  assert.strictEqual(sch[6].ratePct, 5.5, 'month 7 restarts the cycle');
  assert.strictEqual(sch[8].ratePct, 5.5);
});

test('T5c. a 0% fee stays 0% (does not fall back to the default)', () => {
  const sch = T.buildTieredSchedule(100, '2026-08-03', 1, { m1_3: 5.5, m4_6: 6.5, cycleMonths: 6, feePct: 0 });
  assert.strictEqual(sch[0].fee, 0);
  assert.strictEqual(sch[0].amount, 5.5);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: `# fail 3`.

- [ ] **Step 3: Implement `buildTieredSchedule`**

In `treasury.js`, after `maxSafeTicket`:

```js
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
```

- [ ] **Step 4: Export it**

Add to the recommendations line:

```js
    returnWaterfall, fundingRecommendation, pickSourcesForDeal, guaranteeGate, maxSafeTicket, buildTieredSchedule,
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: `# fail 0`, `# pass 36`.

- [ ] **Step 6: Commit**

```bash
git add treasury.js test/treasury.test.js
git commit -m "Engine: tiered return schedule (5.5/6.5 cycling, fee netted)"
```

---

### Task 6: Wire config into migration + adapters in `index.html`

**Files:**
- Modify: `index.html` (migrateSchema treasury block ~line 400, adapters after `engineCfg`)

- [ ] **Step 1: Seed the new config keys in `migrateSchema`**

In `index.html`, find the `S.orgConfig.treasury={` block and replace the closing lines. The block currently ends with:

```js
      papaCall:{base:0,conservative:0.25,stress:1}, papaNoticeDays:30,
      cushionPct:(S.orgConfig.cushionPct!=null?S.orgConfig.cushionPct:15), rrprMultiplier:1.25, sinkHorizonDays:60, investorRatePct:2
    };
```

Replace with:

```js
      papaCall:{base:0,conservative:0.25,stress:1}, papaNoticeDays:30,
      cushionPct:(S.orgConfig.cushionPct!=null?S.orgConfig.cushionPct:15), rrprMultiplier:1.25, sinkHorizonDays:60, investorRatePct:2,
      fundingOrder:['1030','1010','1020'], operatingFloor:0, hardGuaranteeWindowDays:60,
      timingBufferDays:7, singleBorrowerCapPct:40, ownerCashTrap:true,
      tieredReturn:{m1_3:5.5,m4_6:6.5,cycleMonths:6,feePct:0.5}
    };
  }
  // Additive top-up for states migrated before the smart-intake keys existed.
  if(S.orgConfig.treasury && !S.orgConfig.treasury.fundingOrder){
    Object.assign(S.orgConfig.treasury,{
      fundingOrder:['1030','1010','1020'], operatingFloor:0, hardGuaranteeWindowDays:60,
      timingBufferDays:7, singleBorrowerCapPct:40, ownerCashTrap:true,
      tieredReturn:{m1_3:5.5,m4_6:6.5,cycleMonths:6,feePct:0.5}
    });
```

- [ ] **Step 2: Verify syntax**

Run the syntax-check command from Conventions.
Expected: `SYNTAX OK`

- [ ] **Step 3: Add the opportunity adapter after `engineCfg`**

In `index.html`, immediately after `function engineCfg(){ ... }`:

```js
// Opportunities = projects still on offer (status 'tersedia'). Ranked by urgency:
// soonest deadline first, then newest, amount as tiebreak.
function opportunities(q){
  const term=(q||'').trim().toLowerCase();
  return (S.projects||[])
    .filter(p=>p.status==='tersedia')
    .filter(p=>!term || (p.peminjam||'').toLowerCase().includes(term))
    .sort((a,b)=>{
      const da=a.deadline||'9999-12-31', db=b.deadline||'9999-12-31';
      if(da!==db) return da<db?-1:1;
      return parseFloat(b.jumlah||0)-parseFloat(a.jumlah||0);
    });
}
function unseenOpportunityCount(){ return opportunities().filter(p=>!p.seen).length; }
// Deal shape the engine expects, derived from an opportunity project.
function dealFromProject(p){
  const deploy=parseFloat(p.jumlah||0), kontrak=parseFloat(p.kontrak||0);
  const fee=resolveNum(p.adminFeePersen, engineCfg().tieredReturn.feePct);
  const profit=Math.max(0, kontrak-deploy-kontrak*fee/100);
  return { id:p.id, name:p.peminjam, ticket:deploy, profit, maturityDate:p.tanggalJT,
           inflowQuality:p.inflowQuality||'contracted', today:todayISO() };
}
```

- [ ] **Step 4: Verify syntax**

Run the syntax-check command.
Expected: `SYNTAX OK`

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "Wire smart-intake config + opportunity adapters"
```

---

### Task 7: Peluang segment, searchable list, Ringkasan card, deep link

**Files:**
- Modify: `index.html` (`rProyek` ~line 2189, `rB` entry card, `go()` router, init deep-link)

- [ ] **Step 1: Replace `rProyek` with the segmented version**

Replace the whole `rProyek` function (lines 2189-2198) with:

```js
let proyekSeg='peluang', peluangQuery='';
function swProyek(s){ proyekSeg=s; rProyek(); }
function peluangSearch(v){ peluangQuery=v; renderPeluangList(); }
function rProyek(){
  const el=document.getElementById('p-p'); if(!el) return;
  const list=(S.projects||[]);
  const nPel=list.filter(p=>p.status==='tersedia').length;
  const aktif=list.filter(p=>p.status==='aktif'||p.status==='terlambat');
  const selesai=list.filter(p=>p.status==='selesai');
  let h=`<div class="seg" style="margin-bottom:14px">
    <button class="${proyekSeg==='peluang'?'on':''}" onclick="swProyek('peluang')">Peluang${nPel?' ('+nPel+')':''}</button>
    <button class="${proyekSeg==='aktif'?'on':''}" onclick="swProyek('aktif')">Aktif${aktif.length?' ('+aktif.length+')':''}</button>
    <button class="${proyekSeg==='selesai'?'on':''}" onclick="swProyek('selesai')">Selesai</button>
  </div>`;
  if(proyekSeg==='peluang'){
    h+=`<input class="fi" id="pel-q" type="search" placeholder="Cari project atau peminjam"
         value="${peluangQuery.replace(/"/g,'&quot;')}" oninput="peluangSearch(this.value)" style="margin-bottom:10px">
      <div id="pel-list"></div>`;
    el.innerHTML=h; renderPeluangList(); return;
  }
  const rows=proyekSeg==='aktif'?aktif:selesai;
  if(!rows.length){
    h+=`<div class="es"><div class="ei">${proyekSeg==='aktif'?'🌱':'🎉'}</div>
      <div class="et">Belum ada proyek ${proyekSeg}</div></div>`;
  } else rows.forEach(p=>h+=pCard(p,_adminUnlocked));
  el.innerHTML=h;
}
function renderPeluangList(){
  const box=document.getElementById('pel-list'); if(!box) return;
  const list=opportunities(peluangQuery);
  if(!list.length){
    box.innerHTML=peluangQuery
      ? `<div class="es"><div class="ei">🔍</div><div class="et">Tidak ketemu</div><div class="esb">Coba kata lain.</div></div>`
      : `<div class="es"><div class="ei">✅</div><div class="et">Belum ada peluang baru</div><div class="esb">Kami kabari lewat Telegram kalau PGM posting proyek.</div></div>`;
    return;
  }
  box.innerHTML=list.map((p,i)=>peluangCard(p,i)).join('');
}
function peluangCard(p,i){
  const dl=p.deadline, dd=dl?du(dl):null;
  const chip = dl ? `<span class="bdg ${dd!==null&&dd<0?'terlambat':(dd!==null&&dd<=2?'tersedia':'')}"
      style="font-size:9px">${dd!==null&&dd<0?'lewat':gl(dd)}</span>` : '';
  const urgent = i<3 && dd!==null && dd<=7;
  return `<div class="pc tersedia" onclick="openPeluang('${p.id}')"
      style="margin-bottom:10px;cursor:pointer;animation:cardIn .3s ease both;animation-delay:${Math.min(i,6)*40}ms">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
      <div style="min-width:0">
        <div style="font-size:14.5px;font-weight:900;display:flex;align-items:center;gap:6px">
          ${p.seen?'':'<span style="width:7px;height:7px;border-radius:50%;background:var(--p);flex-shrink:0"></span>'}
          ${p.peminjam||'Tanpa nama'}
        </div>
        <div style="font-size:10.5px;color:var(--sub);font-weight:700;margin-top:3px">
          ${p.durasiReturn?p.durasiReturn+' bln · ':''}${p.returnPersen?p.returnPersen+'%/bln':''} ${chip}
        </div>
        ${urgent?'<div style="font-size:9.5px;font-weight:800;color:#B45309;margin-top:3px">perlu perhatian</div>':''}
      </div>
      <div class="t-num" style="font-size:15px;font-weight:900;white-space:nowrap">${fj(parseFloat(p.jumlah||0))}</div>
    </div>
  </div>`;
}
```

- [ ] **Step 2: Verify syntax**

Run the syntax-check command.
Expected: `SYNTAX OK`

- [ ] **Step 3: Add the Ringkasan entry card**

In `index.html`, inside `rB()`, find the line `const tersediaC=S.projects.filter(p=>p.status==='tersedia').length;` and immediately after the `let h=` assignment that starts the Beranda HTML, prepend the card. Locate the first `let h=` inside `rB()` and insert directly after it:

```js
  const _nPel=unseenOpportunityCount();
  if(_nPel && _adminUnlocked) h+=`<div class="card-s" onclick="go('p')"
    style="margin-bottom:12px;cursor:pointer;background:linear-gradient(140deg,#fff,#F3F0FF);display:flex;align-items:center;gap:12px">
    <div style="font-size:22px">✨</div>
    <div style="flex:1;min-width:0">
      <div style="font-size:13.5px;font-weight:900">Peluang baru (${_nPel})</div>
      <div style="font-size:10.5px;color:var(--sub);font-weight:700">Ketuk untuk lihat dan pilih project</div>
    </div>
    <div style="font-size:18px;color:var(--sub)">›</div>
  </div>`;
```

- [ ] **Step 4: Route the Proyek tab to the Peluang segment by default**

In `go()`, find `if(p==='b')rB();else if(p==='p')rProyek();` and leave it as is. Then in the init block at the bottom of the file, after `go('b');`, add the deep-link handler:

```js
// Telegram deep link: ...?peluang=<id> opens that opportunity directly.
(function(){
  const m=/[?&]peluang=([^&]+)/.exec(location.search);
  if(!m) return;
  const id=decodeURIComponent(m[1]);
  setTimeout(()=>{ if(!_adminUnlocked) return; proyekSeg='peluang'; go('p'); openPeluang(id); }, 400);
})();
```

- [ ] **Step 5: Verify syntax**

Run the syntax-check command.
Expected: `SYNTAX OK`

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "UI: Peluang segment with searchable ranked list + Ringkasan entry card"
```

---

### Task 8: Decide-to-enter flow (detail sheet → decision screen → confirm → undo)

**Files:**
- Modify: `index.html` (after `renderPeluangList`, plus `enterDeal`/`undoEnterDeal`)

- [ ] **Step 1: Add the detail sheet**

After `peluangCard` in `index.html`:

```js
function openPeluang(id){
  const p=(S.projects||[]).find(x=>x.id===id);
  if(!p){ toast('Peluang tidak ditemukan'); return; }
  if(!p.seen){ p.seen=true; save(); renderPeluangList(); }
  if(p.status!=='tersedia'){
    document.getElementById('mo-keu-t').textContent='Peluang sudah tidak tersedia';
    document.getElementById('mo-keu-b').innerHTML=`<div class="fc-note">Project ini sudah tidak berstatus tersedia.</div>
      <button class="btn ou fw" onclick="cm('mo-keu');go('p')" style="margin-top:10px">Lihat peluang lain</button>`;
    om('mo-keu'); return;
  }
  const deploy=parseFloat(p.jumlah||0);
  document.getElementById('mo-keu-t').textContent=p.peminjam||'Peluang';
  document.getElementById('mo-keu-b').innerHTML=`
    <div class="card-s" style="margin-bottom:12px">
      <div class="rep-r"><span class="rl">Jumlah dana</span><span class="rv">${fj(deploy)}</span></div>
      <div class="rep-r"><span class="rl">Durasi</span><span class="rv">${p.durasiReturn||'—'} bln</span></div>
      <div class="rep-r"><span class="rl">Return</span><span class="rv">${p.returnPersen?p.returnPersen+'%/bln':'—'}</span></div>
      <div class="rep-r"><span class="rl">Jatuh tempo</span><span class="rv">${p.tanggalJT?fd(p.tanggalJT):'—'}</span></div>
    </div>
    <button class="btn pr fw" onclick="startMasukProject('${p.id}')">Masuk project</button>
    <button class="btn ou fw" onclick="cm('mo-keu')" style="margin-top:8px">Belum, nanti dulu</button>`;
  om('mo-keu');
}
```

- [ ] **Step 2: Add the dry-run + decision screen**

Directly after `openPeluang`:

```js
let _pendingDeal=null;
function startMasukProject(id){
  const p=(S.projects||[]).find(x=>x.id===id); if(!p) return;
  document.getElementById('mo-keu-b').innerHTML=`<div class="fc-note" style="text-align:center;padding:20px">Mengecek kas &amp; jadwal balik…</div>`;
  setTimeout(()=>renderDecision(id), 380); // honest beat: a pause before committing money
}
function renderDecision(id, overrideMix){
  const p=(S.projects||[]).find(x=>x.id===id); if(!p) return;
  const st=engineState(), cfg=engineCfg(), today=todayISO();
  const deal=dealFromProject(p);
  const picked=overrideMix||Treasury.pickSourcesForDeal(st,cfg,deal).mix;
  const shortfall=Treasury.R4(deal.ticket-picked.reduce((s,m)=>s+m.amount,0));
  const g=Treasury.guaranteeGate(st,cfg,deal,picked,today);
  _pendingDeal={id, mix:picked, verdict:g.verdict};
  const V={GREEN:{c:'#0B8F46',bg:'#D1FAE5',t:'AMAN'},YELLOW:{c:'#B45309',bg:'#FEF3C7',t:'HATI-HATI'},RED:{c:'#DC2626',bg:'#FEE2E2',t:'TIDAK AMAN'}}[g.verdict];
  let b=`<div class="card-s" style="background:${V.bg};margin-bottom:12px;text-align:center;padding:14px">
    <div style="font-size:20px;font-weight:900;color:${V.c}">${V.t}</div>
    <div style="font-size:11px;font-weight:700;color:var(--txt);margin-top:2px">${g.reason}</div></div>`;
  b+=`<div class="rep-sec">Uang dari kantong</div><div class="card-s" style="margin-bottom:12px">`;
  picked.forEach(m=>{
    const before=Treasury.pocketBal(st,m.code), after=Treasury.R4(before-m.amount);
    b+=`<div class="rep-r"><span class="rl">${acct(m.code).name}${m.bridge?' <b style="color:#B45309">(pinjam cadangan)</b>':''}
      <div style="font-size:9.5px;color:var(--sub)">${fj(before)} → ${fj(after)}</div></span>
      <span class="rv">${fj(m.amount)}</span></div>`;
  });
  if(shortfall>0.005) b+=`<div class="rep-r" style="color:var(--r)"><span class="rl">Kurang</span><span class="rv">${fj(shortfall)}</span></div>`;
  b+=`<div class="rep-r" style="border-top:1.5px solid var(--bdr);margin-top:2px;padding-top:5px"><span class="rl">Porsi kas likuid</span><span class="rv">${g.exposurePct}%</span></div></div>`;
  b+=`<div class="rep-sec">Cek pembayaran investor</div><div class="card-s" style="margin-bottom:12px">`;
  const rows=g.ladder.rows.slice(0,6);
  if(!rows.length) b+=`<div class="fc-note">Tidak ada kewajiban investor terjadwal.</div>`;
  rows.forEach(r=>{
    const mark=!r.covered?'❌':(r.tight?'⚠️':'✅');
    const col=!r.covered?'var(--r)':(r.tight?'#B45309':'#0B8F46');
    b+=`<div class="rep-r"><span class="rl" style="font-size:11px">${mark} ${r.label}
      <div style="font-size:9.5px;color:var(--sub)">${fd(r.date)} · sisa kas ${fj(r.cumulativeCash)}</div></span>
      <span class="rv" style="color:${col}">${fj(r.obligation)}</span></div>`;
  });
  b+=`</div>`;
  if(g.verdict==='RED'){
    const best=Treasury.maxSafeTicket(st,cfg,deal,today);
    b+=`<div class="fc-note" style="color:var(--r);margin-bottom:10px">Aman maksimal ${fj(best.ticket)}. Di atas itu, ${g.firstBreach.label} pada ${fd(g.firstBreach.date)} tidak tertutup.</div>
      <div class="fg"><label class="fl">Alasan tetap lanjut (wajib)</label><input class="fi" id="dec-reason" placeholder="mis. yakin investor masuk sebelum tanggal itu"></div>`;
  }
  b+=`<button class="btn pr fw" onclick="confirmMasuk('${id}')">Masuk project — danai ${fj(deal.ticket)}</button>
    <button class="btn ou fw" onclick="cm('mo-keu')" style="margin-top:8px">Belum, simpan dulu</button>`;
  document.getElementById('mo-keu-t').textContent='Cek sebelum masuk';
  document.getElementById('mo-keu-b').innerHTML=b;
}
```

- [ ] **Step 3: Add confirm + undo**

Directly after `renderDecision`:

```js
let _lastEnter=null;
function confirmMasuk(id){
  const p=(S.projects||[]).find(x=>x.id===id); if(!p||!_pendingDeal) return;
  let reason='';
  if(_pendingDeal.verdict==='RED'){
    const el=document.getElementById('dec-reason'); reason=el?el.value.trim():'';
    if(!reason){ toast('❌ Isi alasan dulu'); return; }
  }
  const mix=_pendingDeal.mix, total=Treasury.R4(mix.reduce((s,m)=>s+m.amount,0));
  if(!(total>0)){ toast('❌ Tidak ada dana untuk dipakai'); return; }
  const lines=[{account:'1100',debit:total,credit:0}].concat(mix.map(m=>({account:m.code,debit:0,credit:m.amount})));
  const e=ledgerPost(todayISO(),'Deploy ke proyek: '+(p.peminjam||''),lines,'deploy');
  const prev={status:p.status, tanggalAktif:p.tanggalAktif};
  p.status='aktif'; p.tanggalAktif=todayISO();
  const names=(S.orgConfig.activeProjectNames||[]);
  if(p.peminjam && !names.includes(p.peminjam)){ names.push(p.peminjam); S.orgConfig.activeProjectNames=names; }
  const bridge=mix.find(m=>m.bridge);
  if(bridge){ S.bridges=S.bridges||[]; S.bridges.push({amount:bridge.amount, restoreBy:bridge.restoreBy, dealId:p.id}); }
  S.decisionLog=S.decisionLog||[];
  S.decisionLog.push({ts:new Date().toISOString(), dealId:p.id, verdict:_pendingDeal.verdict,
    chosen:mix.map(m=>({code:m.code,amount:m.amount})), reason:reason||null});
  _lastEnter={entryId:e.id, projectId:p.id, prev, hadBridge:!!bridge, addedName:p.peminjam};
  save(); cm('mo-keu'); rAll();
  toast('✅ Project aktif', {duration:7000, undo:undoEnterDeal});
}
function undoEnterDeal(){
  if(!_lastEnter) return;
  S.ledger=(S.ledger||[]).filter(x=>x.id!==_lastEnter.entryId);
  const p=(S.projects||[]).find(x=>x.id===_lastEnter.projectId);
  if(p){ p.status=_lastEnter.prev.status; p.tanggalAktif=_lastEnter.prev.tanggalAktif; }
  if(_lastEnter.hadBridge) S.bridges=(S.bridges||[]).filter(b=>b.dealId!==_lastEnter.projectId);
  S.decisionLog=(S.decisionLog||[]).filter(d=>d.dealId!==_lastEnter.projectId||d.ts!==(S.decisionLog[S.decisionLog.length-1]||{}).ts);
  if(_lastEnter.addedName) S.orgConfig.activeProjectNames=(S.orgConfig.activeProjectNames||[]).filter(n=>n!==_lastEnter.addedName);
  _lastEnter=null; save(); rAll(); toast('↩ Dibatalkan');
}
```

- [ ] **Step 4: Verify syntax**

Run the syntax-check command.
Expected: `SYNTAX OK`

- [ ] **Step 5: Verify in the browser preview**

Open `http://localhost:5173`, then in the console:

```js
_adminUnlocked=true; ['n-p','n-u','n-r'].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display='';});
window.confirm=()=>true; seedRoxanne(); go('p');
```

Expected: the Proyek tab shows the `Peluang / Aktif / Selesai` segments, the search box, and ranked opportunity cards. Tapping a card opens the detail sheet; "Masuk project" shows the verdict, pocket mix, and per-date investor check.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "UI: decide-to-enter flow with verdict, pocket mix, payability proof, undo"
```

---

### Task 9: Owner cash-trap + RRPR bridge visibility

**Files:**
- Modify: `treasury.js` (`returnWaterfall`), `index.html` (Treasury hub)
- Test: `test/treasury.test.js`

- [ ] **Step 1: Write the failing test**

```js
// ── Task 9: owner cash trap ─────────────────────────────────────────────────
test('T9a. owner draw is suppressed while a near obligation is unfunded', () => {
  const st = S({
    ledger: [entry('2026-08-01', [dr('1010', 5), cr('3000', 5)])],
    providers: [{ id: 'p1', classification: 'investor_debt', subtype: 'regular' }],
    contracts: [{ id: 'c1', providerId: 'p1', principal: 40, nama: 'Investor A', schedule: [
      { tanggal: '2026-08-20', jumlah: 40, tipe: 'pokok', status: 'pending' },
    ] }],
  });
  const w = T.returnWaterfall(st, T.cfgOf({}), 10, TODAY);
  assert.strictEqual(w.ownerTrapped, true, 'flagged because obligations are not yet covered');
  assert.strictEqual(w.freeAttack, 0, 'nothing released to the owner while trapped');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: `# fail 1`.

- [ ] **Step 3: Add the cash trap to `returnWaterfall`**

In `treasury.js`, inside `returnWaterfall`, replace the `return {` block with:

```js
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: `# fail 0`, `# pass 37`.

- [ ] **Step 5: Show outstanding bridges in the Treasury hub**

In `index.html`, inside `rTreasuryHub()`, immediately before the line that starts `// 7) recommendation tools`, insert:

```js
  const _bridges=(S.bridges||[]);
  if(_bridges.length){
    h+=`<div class="rep-sec" style="color:#B45309">🌉 Pinjaman Cadangan (harus dikembalikan)</div><div class="card-s" style="margin-bottom:12px">`;
    _bridges.forEach(b=>{ const pr=(S.projects||[]).find(x=>x.id===b.dealId);
      h+=`<div class="rep-r"><span class="rl">${pr?pr.peminjam:'Proyek'}<div style="font-size:9.5px;color:var(--sub)">kembalikan sebelum ${fd(b.restoreBy)}</div></span><span class="rv">${fj(b.amount)}</span></div>`; });
    h+=`</div>`;
  }
```

- [ ] **Step 6: Verify syntax + commit**

Run the syntax-check command. Expected: `SYNTAX OK`

```bash
git add treasury.js test/treasury.test.js index.html
git commit -m "Engine+UI: owner cash-trap on returns, RRPR bridge tracking"
```

---

### Task 10: Full verification + review + merge

**Files:** none (verification only)

- [ ] **Step 1: Run the whole suite**

Run: `node --test 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: `# fail 0` and at least `# pass 37`.

- [ ] **Step 2: Syntax-check both files**

```bash
node --check treasury.js && echo "treasury OK"
```
Plus the `index.html` syntax-check command from Conventions.
Expected: both OK.

- [ ] **Step 3: Browser smoke test**

Reload `http://localhost:5173`, unlock admin, seed, then verify in order:
1. Ringkasan shows the "Peluang baru (N)" card.
2. Proyek → Peluang lists ranked opportunities; search filters them.
3. Tapping a card opens the detail sheet; "Masuk project" shows a verdict.
4. The pocket mix never includes "Investor Jatuh Tempo".
5. Confirm flips the project to Aktif and shows the undo toast; undo restores it.
6. `Treasury.openingChecks(engineState()).checks.every(c=>c.ok)` is still `true`.
7. `read_console_messages` shows no errors.

- [ ] **Step 4: Request code review**

Use superpowers:requesting-code-review on the full branch diff. Fix anything it flags, re-running `node --test` after each fix.

- [ ] **Step 5: Finish the branch**

Use superpowers:finishing-a-development-branch: confirm tests pass, review `git diff main..HEAD` for accidental data or credential changes, then merge to `main` and push only if everything is green.

---

## Self-Review

**Spec coverage:** §3 two-engine split → Tasks 2+4. §4.1 config → Task 1+6. §4.2 freeCash → Task 1. §4.3 pickSources → Task 2. §4.4 paymentLadder → Task 3. §4.5 guaranteeGate → Task 4. §4.6 maxSafeTicket → Task 4. §4.7 enterDeal/undo → Task 8. §4.8 tiered schedule → Task 5. §4.9 waterfall + cash-trap → Task 9. §5.1 IA/segment → Task 7. §5.2 deep link → Task 7. §5.3 list/card → Task 7. §5.4 flow → Task 8. §5.5 states → Tasks 7+8. §7 data model deltas (`seen`, `deadline`, `bridges`, `decisionLog`) → Tasks 7+8. §10 milestones → Tasks 1-10.

**Deferred to a follow-up plan (not silently dropped):** §4.8 wiring `buildTieredSchedule` into the *project creation form* (the engine function and its tests ship here; the form field is UI-only and belongs with the next batch), and §8's rarer edge cases (early repayment re-matching, per-investor committed-rollover toggle, explicit borrower-default scenario). The guarantee itself does not depend on them.

**Placeholder scan:** none — every step contains runnable code or an exact command.

**Type consistency:** `pickSourcesForDeal` returns `{mix, shortfall, usesBridge}`; `mix` entries are `{code, amount, bridge, restoreBy}` and are consumed unchanged by `paymentLadder(opts.mix)`, `guaranteeGate(mix)`, and `confirmMasuk`. `paymentLadder` returns `{rows, minBuffer, minGap, firstBreach, startCash}`; `guaranteeGate` reads `.rows`, `.minGap`, `.minBuffer`, `.firstBreach` and returns `{verdict, ladder, exposurePct, usesBridge, firstBreach, reason}`, all of which `renderDecision` uses by those names. `dealFromProject` produces `{id,name,ticket,profit,maturityDate,inflowQuality,today}`, matching every engine consumer.
