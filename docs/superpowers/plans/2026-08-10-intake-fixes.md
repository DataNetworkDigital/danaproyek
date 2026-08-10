# Intake Fixes + Advisory Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Fix four issues found in real use, and change the guarantee from a gatekeeper into an advisor that always tells Gde exactly how much money to bring in and by when.

**Architecture:** New pure `fundingNeed()` in `treasury.js` turns any RED/short verdict into an actionable injection requirement. Two idempotent data migrations in `index.html` repair existing production data. Peluang cards switch to the admin/investor value convention.

**Tech Stack:** Vanilla JS, `treasury.js` UMD, `node --test`.

**Branch:** `intake-fixes-20260810`

---

## Findings this plan is based on (verified against production data)

| Finding | Evidence |
|---|---|
| Peluang cards show `p.jumlah` (dana diperlukan) even for admin | `index.html` `peluangCard` renders `fj(parseFloat(p.jumlah))` |
| Deployed (373.275) does not match active projects (94.5) | ledger 1100 = 373.275; only AYAM 47.25 + PELAYARAN 47.25 are `aktif` |
| The missing pair is Tani dan vila Ngawi (189) + SAWAH WARTINI (89.775) | 373.275 − 94.5 = 278.775; 278.775 − 189 = 89.775; **SAWAH WARTINI is the only exact match** (others: 95, 94.5, 85.05) |
| Veda 66.15 and Fuad 32.5 have a bagi hasil dated on their start date | both `tanggalMulai` 2026-08-03 with a pending `bagihasil` on 2026-08-03; first payment must be 2026-09-03 |

`buildRealSchedule` in current code is already correct (`m = startM+1` for non-flexible); the production rows are stale data from an older seed.

---

### Task 1: `fundingNeed()` — turn a breach into "bring X before Y"

**Files:** Modify `treasury.js`; Test `test/treasury.test.js`

- [ ] **Step 1: Write the failing tests**

```js
test('F1a. a breach becomes a dated injection requirement', () => {
  const st = S({
    ledger: [entry('2026-08-01', [dr('1010', 10), cr('3000', 10)])],
    providers: [{ id: 'p1', classification: 'investor_debt', subtype: 'regular' }],
    contracts: [{ id: 'c1', providerId: 'p1', principal: 50, nama: 'Investor A', schedule: [
      { tanggal: '2026-09-03', jumlah: 50, tipe: 'pokok', status: 'pending' },
    ] }],
  });
  const cfg = T.cfgOf({});
  const need = T.fundingNeed(st, cfg, { ticket: 0, maturityDate: '2026-12-01' }, [], TODAY);
  assert.ok(need.injection >= 40, 'must ask for at least the 40 shortfall');
  assert.strictEqual(need.byDate, '2026-09-03', 'deadline is the first date that breaks');
  assert.strictEqual(need.shortfallNow, 0);
});

test('F1b. an unfundable deal reports the cash needed before disbursement', () => {
  const st = S({ ledger: [entry('2026-08-01', [dr('1100', 50), cr('3000', 50)])] });
  const cfg = T.cfgOf({});
  const deal = { ticket: 100, maturityDate: '2026-12-01', today: TODAY };
  const mix = T.pickSourcesForDeal(st, cfg, deal).mix;
  const need = T.fundingNeed(st, cfg, deal, mix, TODAY);
  assert.strictEqual(need.shortfallNow, 100, 'the whole ticket is unfunded');
  assert.strictEqual(need.byDate, TODAY, 'needed before we can disburse');
});

test('F1c. a safe deal needs nothing', () => {
  const st = S({ ledger: [entry('2026-08-01', [dr('1010', 500), cr('3000', 500)])] });
  const cfg = T.cfgOf({});
  const deal = { ticket: 10, maturityDate: '2026-12-01', today: TODAY };
  const mix = T.pickSourcesForDeal(st, cfg, deal).mix;
  const need = T.fundingNeed(st, cfg, deal, mix, TODAY);
  assert.strictEqual(need.injection, 0);
  assert.strictEqual(need.shortfallNow, 0);
  assert.strictEqual(need.byDate, null);
});
```

- [ ] **Step 2: Run to verify they fail** — `node --test`, expect 3 failures.

- [ ] **Step 3: Implement, after `guaranteeGate`**

```js
  // Advisory, not gatekeeping: given a deal we WILL enter, how much extra cash must
  // arrive and by when so no investor payment is missed. This replaces blocking.
  function fundingNeed(state, cfg, deal, mix, today) {
    const funded = R4((mix || []).reduce((s, m) => s + R4(m.amount), 0));
    const shortfallNow = R4(Math.max(0, R4(deal.ticket || 0) - funded));
    // Model the full ticket leaving now, even the part we cannot fund yet.
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
      shortfallNow,
      injection,
      byDate: shortfallNow > 0.005 ? today : byDate,
      total: R4(Math.max(shortfallNow, injection)),
      ladder,
    };
  }
```

- [ ] **Step 4: Export** — add `fundingNeed` to the recommendations line.
- [ ] **Step 5: Run tests** — expect all pass.
- [ ] **Step 6: Commit** — `git commit -m "Engine: fundingNeed turns a breach into 'bring X before Y'"`

---

### Task 2: Peluang cards show project value for admin

**Files:** Modify `index.html` (`peluangCard`)

Convention: dana diperlukan (deploy) is the investor-facing number; admin sees nilai project (kontrak).

- [ ] **Step 1:** In `peluangCard`, replace the amount expression
  `${fj(parseFloat(p.jumlah||0))}` with `${fj(_adminUnlocked?kontrakP(p):publicKontrakP(p))}`
  and add a small sub-label under it showing the deploy for admin:
  `${_adminUnlocked?`<div style="font-size:9px;color:var(--sub);font-weight:700;text-align:right">dana ${fj(parseFloat(p.jumlah||0))}</div>`:''}`
- [ ] **Step 2:** Syntax-check, verify in preview that a Peluang card shows kontrak as the headline number.
- [ ] **Step 3:** Commit.

---

### Task 3: Never block — always advise

**Files:** Modify `index.html` (`renderDecision`, `confirmMasuk`)

Gde will enter the chosen deal regardless; the app's job is to state the requirement, not to refuse.

- [ ] **Step 1:** In `renderDecision`, replace the `cantFund` branch that hides the confirm button. Always render the confirm button. When `g.verdict==='RED'` or `shortfall>0`, render a "Yang dibutuhkan" card built from `Treasury.fundingNeed(...)`:
  "Butuh dana masuk **Rp X** sebelum **tgl Y** (investor baru atau modal pribadi)."
- [ ] **Step 2:** Keep the typed reason only as an optional note (not a gate). Remove the `if(!reason) return;` block in `confirmMasuk`.
- [ ] **Step 3:** Keep the stale-mix re-validation guard (that one protects the ledger, not the decision).
- [ ] **Step 4:** When `shortfall>0`, post only the funded portion to the ledger and record the gap in the decision log, so the books never claim money that did not move.
- [ ] **Step 5:** Syntax-check, verify in preview: an unfundable deal still shows a confirm button plus the requirement line.
- [ ] **Step 6:** Commit.

---

### Task 4: Migration — drop bagi hasil dated on/before the contract start

**Files:** Modify `index.html` (`migrateSchema`)

Non-flexible contracts pay their first bagi hasil one month after the money lands. Any row dated on or before `tanggalMulai` is stale seed data.

- [ ] **Step 1:** Add to `migrateSchema`, after the treasury config block:

```js
  // Data repair: a non-flexible contract cannot owe bagi hasil on the day the money
  // arrives. Stale seeds produced one; drop it (idempotent).
  (S.investorContracts||[]).forEach(c=>{
    if(c.flexible || !c.tanggalMulai || !Array.isArray(c.schedule)) return;
    const before=c.schedule.length;
    c.schedule=c.schedule.filter(s=>!(s.tipe==='bagihasil' && s.tanggal<=c.tanggalMulai && s.status!=='paid'));
    if(c.schedule.length!==before) console.log('[fix] bagi hasil di tanggal masuk dihapus:',c.nama);
  });
```

- [ ] **Step 2:** Verify in preview against production data that Veda 66.15 and Fuad 32.5 now start on 2026-09-03, and that Papa (flexible) and the older contracts are untouched.
- [ ] **Step 3:** Commit.

---

### Task 5: Detect + one-tap repair for the deployed/active mismatch

**Files:** Modify `index.html` (Treasury hub + a repair action)

Do not silently rewrite project statuses. Detect the mismatch, show the proposed pairing, let Gde apply it with one tap.

- [ ] **Step 1:** Add `deployMismatch()` returning `{deployed, activeSum, gap, suggestion:[{id,nama,jumlah}]}` where the suggestion is the set of `tersedia` projects listed in `orgConfig.activeProjectNames` whose deploys sum exactly to the gap.
- [ ] **Step 2:** In `rTreasuryHub`, when `gap > 0.005`, render an amber card: "Dana terpakai Rp373,275 tapi proyek aktif cuma Rp94,5. Kemungkinan: Tani dan vila Ngawi + SAWAH WARTINI" with a button `applyDeployFix()`.
- [ ] **Step 3:** `applyDeployFix()` sets those projects to `status:'aktif'` with `tanggalAktif` = their `tanggalMulai`, saves, re-renders, and toasts with an undo.
- [ ] **Step 4:** Verify in preview: the card appears, tapping it makes deployed match active, and the Treasury opening checks stay green.
- [ ] **Step 5:** Commit.

---

### Task 6: Verify, review, merge

- [ ] **Step 1:** `node --test` — all pass.
- [ ] **Step 2:** `node --check` both files.
- [ ] **Step 3:** Preview smoke: Peluang values, advisory decision screen, both migrations, repair card.
- [ ] **Step 4:** Review `git diff origin/main..HEAD` for accidental data or credential changes.
- [ ] **Step 5:** Push branch; merge to main only if green.

---

## Deferred (explicitly, with reasons)

- **Telegram reminder bot** for bagi hasil + pokok due dates — user asked to remember this for later, not now. Design note: the app is a static page with no scheduler, so reminders belong in the existing n8n robot reading `investorContracts[].schedule` (each row already has `tanggal`, `tipe`, `jumlah`, `status`), firing H-3 and H-0 per pending row, with the message deep-linking to `?peluang=` style URLs. No app change needed beyond making the schedule readable.
- **Editable pocket mix** on the decision screen (spec §5.4) — still open.
- **Tiered schedule wiring** into the project form and `enterDeal`.
- **RRPR bridge auto-clear** when RRPR is topped back up.
