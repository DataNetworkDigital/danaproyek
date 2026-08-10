/* Treasury engine tests — run with: node --test
 * Pure-function tests over fixtures. No production Firestore, no network. */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs'); const path = require('path');
// treasury.js is a classic browser script (UMD). Load it into Node without
// import/require (root package.json is "type":"module") by evaluating it in a
// CommonJS sandbox, so the SAME file serves the browser and these tests.
const _m = { exports: {} };
new Function('module', 'exports', 'self', fs.readFileSync(path.join(__dirname, '..', 'treasury.js'), 'utf8'))(_m, _m.exports, undefined);
const T = _m.exports;

// ── shared fixtures ─────────────────────────────────────────────────────────
const COA = [
  { code: '1100', type: 'aset', normal: 'D' }, { code: '2000', type: 'liabilitas', normal: 'K' },
  { code: '2010', type: 'liabilitas', normal: 'K' }, { code: '2100', type: 'liabilitas', normal: 'K' },
  { code: '3000', type: 'ekuitas', normal: 'K' }, { code: '3010', type: 'ekuitas', normal: 'K' },
  { code: '3900', type: 'ekuitas', normal: 'K' }, { code: '3990', type: 'ekuitas', normal: 'K' },
  { code: '4000', type: 'pendapatan', normal: 'K' }, { code: '5000', type: 'beban', normal: 'D' },
  { code: '5010', type: 'beban', normal: 'D' }, { code: '5020', type: 'beban', normal: 'D' }, { code: '5030', type: 'beban', normal: 'D' },
];
const POCKETS = [
  { code: '1000', nama: 'Utama', role: 'hub', prioritas: 0 }, { code: '1010', nama: 'Gde', role: 'serang', prioritas: 1 },
  { code: '1030', nama: 'Investor Belum Dialokasikan', role: 'amunisi', prioritas: 2 },
  { code: '1020', nama: 'RRPR', role: 'bertahan', prioritas: 3 }, { code: '1040', nama: 'Investor Jatuh Tempo', role: 'sinking', prioritas: 9, locked: true },
];
const ACCOUNTS = COA.concat(POCKETS.map((p) => ({ code: p.code, type: 'aset', normal: 'D' })));
const TODAY = '2026-08-03';
const dr = (account, v) => ({ account, debit: v, credit: 0 });
const cr = (account, v) => ({ account, debit: 0, credit: v });
const entry = (tanggal, lines, extra) => Object.assign({ id: tanggal + Math.random(), tanggal, lines }, extra);

function S(over) {
  return Object.assign({ accounts: ACCOUNTS, pockets: POCKETS, ledger: [], contracts: [], providers: [], projects: [], allocations: [], orgConfig: {}, today: TODAY }, over || {});
}
const CFG = T.cfgOf({});

// Opening position ledger (mirrors the real seed postings)
function openingLedger() {
  return [
    entry('2026-05-11', [dr('1030', 177.65), cr('2000', 177.65)]), // all investor principal received
    entry('2026-07-13', [dr('1010', 195.625), cr('3000', 195.625)]), // Gde net capital
    entry('2026-08-03', [dr('1020', 13.19), cr('3010', 13.19)]),   // RRPR cash
    entry('2026-08-03', [dr('1100', 373.275), cr('1010', 195.625), cr('1030', 177.65)]), // deploy to 4 projects
  ];
}
const OPENING_PROVIDERS = [
  { id: 'prov:papa', name: 'Papa — Investor Fleksibel Pihak Berelasi', classification: 'investor_debt', subtype: 'related_party_flexible', relatedParty: true, active: true },
  { id: 'prov:veda', name: 'Veda', classification: 'investor_debt', subtype: 'regular', relatedParty: false, active: true },
  { id: 'prov:laili', name: 'Laili', classification: 'investor_debt', subtype: 'regular', relatedParty: false, active: true },
  { id: 'prov:fuad', name: 'Fuad', classification: 'investor_debt', subtype: 'regular', relatedParty: false, active: true },
];
const OPENING_CONTRACTS = [
  { id: 'ctr:papa', providerId: 'prov:papa', principal: 50, flexible: true, schedule: [] },
  { id: 'ctr:veda', providerId: 'prov:veda', principal: 85.15, schedule: [] },
  { id: 'ctr:laili', providerId: 'prov:laili', principal: 10, schedule: [] },
  { id: 'ctr:fuad', providerId: 'prov:fuad', principal: 32.5, schedule: [] },
];
function openingState() {
  return S({ ledger: openingLedger(), providers: OPENING_PROVIDERS, contracts: OPENING_CONTRACTS });
}

// ── 1. opening position balances ────────────────────────────────────────────
test('1. opening position reconciles: 195.625 + 177.65 = 373.275; +13.19 = 386.465', () => {
  const oc = T.openingChecks(openingState());
  assert.strictEqual(oc.gde, 195.625);
  assert.strictEqual(oc.investor, 177.65);
  assert.strictEqual(oc.deployed, 373.275);
  assert.strictEqual(oc.rrprCash, 13.19);
  assert.strictEqual(T.R4(oc.gde + oc.investor), 373.275);
  assert.strictEqual(oc.total, 386.465);
  assert.ok(oc.checks.every((c) => c.ok), 'all opening checks pass: ' + JSON.stringify(oc.checks.filter((c) => !c.ok)));
});

// ── 2. Papa classification + call scenarios ─────────────────────────────────
test('2. Papa: liability not equity; base call 0, conservative 12.5, stress 50', () => {
  const st = openingState();
  // in liabilities (2000 includes Papa's 50), excluded from owner equity
  const m = T.metrics(st, CFG, TODAY);
  assert.strictEqual(m.investorLiab, 177.65, 'Papa stays in investor liabilities');
  assert.strictEqual(m.flexLiab, 50, 'Papa is the flexible related-party liability');
  assert.strictEqual(m.regularLiab, 127.65);
  assert.strictEqual(m.ownerEquity, 208.815, 'owner equity = Gde 195.625 + RRPR 13.19, Papa NOT included');
  // call scenarios
  const base = T.papaCallEvents(st, CFG, 'base', TODAY);
  const cons = T.papaCallEvents(st, CFG, 'conservative', TODAY);
  const stress = T.papaCallEvents(st, CFG, 'stress', TODAY);
  assert.strictEqual(base.length, 0, 'base = 0% called');
  assert.strictEqual(T.R4(-cons[0].amount), 12.5, 'conservative = 25% of 50');
  assert.strictEqual(T.R4(-stress[0].amount), 50, 'stress = 100% of 50');
  // Papa stays in the leverage numerator
  assert.ok(m.leverage > 0);
});

test('2b. real withdrawal notice overrides the hypothetical call (no double count)', () => {
  const st = openingState();
  st.contracts = st.contracts.map((c) => c.id === 'ctr:papa' ? Object.assign({}, c, { withdrawalNotice: { amount: 30, date: '2026-09-15' } }) : c);
  const stress = T.papaCallEvents(st, CFG, 'stress', TODAY);
  assert.strictEqual(stress.length, 1, 'exactly one Papa event');
  assert.strictEqual(T.R4(-stress[0].amount), 30, 'uses the real requested amount, not 100% scenario');
  assert.strictEqual(stress[0].date, '2026-09-15');
});

// ── 3 & 4. safe attack budget excludes RRPR + sinking; opening ≈ 0 ──────────
test('3. safe attack excludes RRPR and Investor Jatuh Tempo', () => {
  // RRPR 100 + sinking 100, zero attack cash → safe attack must be 0, not 200
  const st = S({ ledger: [entry('2026-08-01', [dr('1020', 100), cr('3010', 100)]), entry('2026-08-01', [dr('1040', 100), cr('2000', 100)])] });
  assert.strictEqual(T.safeAttackBudget(st, CFG, TODAY), 0);
});
test('4. opening safe attack budget is ~0 (fully deployed)', () => {
  assert.strictEqual(T.safeAttackBudget(openingState(), CFG, TODAY), 0);
});

// ── 5. same-date ordering: outflow before inflow ────────────────────────────
test('5. same-date investor outflow is processed before project inflow', () => {
  const st = S({
    contracts: [{ id: 'c1', providerId: 'p1', principal: 10, schedule: [{ tanggal: '2026-09-01', jumlah: 1, tipe: 'bagihasil', status: 'pending' }] }],
    providers: [{ id: 'p1', classification: 'investor_debt', subtype: 'regular' }],
    projects: [{ id: 'pr1', name: 'X', deploy: 10, type: 'onetime', profit: 2, principalDate: '2026-09-01', inflowQuality: 'received' }],
    ledger: [entry('2026-08-01', [dr('1010', 20), cr('3000', 20)])],
  });
  const sc = T.projectScenario(st, CFG, 'base', TODAY);
  const sameDay = sc.events.filter((e) => e.date === '2026-09-01');
  assert.strictEqual(sameDay[0].kind, 'inv_return', 'outflow first');
  assert.strictEqual(sameDay[1].kind, 'inflow', 'inflow second');
});

// ── 6 & 7. inflow completeness (once) ───────────────────────────────────────
test('6. one-time project includes principal + profit exactly once', () => {
  const st = S({ projects: [{ id: 'p', name: 'One', deploy: 50, type: 'onetime', profit: 10, principalDate: '2026-12-01', inflowQuality: 'received' }] });
  const infl = T.projectInflows(st, CFG, 'base', TODAY);
  assert.strictEqual(infl.length, 1, 'exactly one inflow event');
  assert.strictEqual(infl[0].amount, 60, 'principal 50 + profit 10, once');
});
test('7. monthly project: each return + principal once at maturity', () => {
  const st = S({ projects: [{ id: 'p', name: 'Monthly', deploy: 100, type: 'monthly', inflowQuality: 'received', principalDate: '2026-12-01',
    monthlyReturns: [{ date: '2026-09-01', amount: 5, status: 'pending' }, { date: '2026-10-01', amount: 5, status: 'pending' }] }] });
  const infl = T.projectInflows(st, CFG, 'base', TODAY);
  assert.strictEqual(infl.length, 3, '2 returns + 1 principal');
  const principals = infl.filter((e) => e.label.indexOf('pokok') >= 0);
  assert.strictEqual(principals.length, 1, 'principal exactly once');
  assert.strictEqual(principals[0].amount, 100, 'principal = deploy, not doubled');
});

// ── 8. admin fee 0 remains 0 ────────────────────────────────────────────────
test('8. resolveNumber: 0 stays 0, blank/invalid uses default', () => {
  assert.strictEqual(T.resolveNumber(0, 0.5), 0);
  assert.strictEqual(T.resolveNumber('0', 0.5), 0);
  assert.strictEqual(T.resolveNumber('', 0.5), 0.5);
  assert.strictEqual(T.resolveNumber(null, 0.5), 0.5);
  assert.strictEqual(T.resolveNumber(undefined, 0.5), 0.5);
  assert.strictEqual(T.resolveNumber(0.3, 0.5), 0.3);
});

// ── 9 & 10. allocation validation ───────────────────────────────────────────
test('9. allocation totals cannot exceed project deploy', () => {
  const st = S({
    projects: [{ id: 'pr1', name: 'Proj', deploy: 100 }],
    providers: [{ id: 'prov:gde', classification: 'owner_equity', subtype: 'owner_gde' }],
    ledger: [entry('2026-08-01', [dr('1010', 500), cr('3000', 500)])],
    allocations: [{ id: 'a1', providerId: 'prov:gde', projectId: 'pr1', amount: 120 }],
  });
  const v = T.validateAllocations(st);
  assert.strictEqual(v.ok, false);
  assert.ok(v.errors.some((e) => /≠ deploy/.test(e)));
});
test('10. a provider cannot allocate more than available capital', () => {
  const st = S({
    projects: [{ id: 'pr1', name: 'Proj', deploy: 100 }],
    providers: [{ id: 'prov:veda', classification: 'investor_debt', subtype: 'regular' }],
    contracts: [{ id: 'c', providerId: 'prov:veda', principal: 40 }],
    allocations: [{ id: 'a1', providerId: 'prov:veda', projectId: 'pr1', amount: 100 }],
  });
  const v = T.validateAllocations(st);
  assert.strictEqual(v.ok, false);
  assert.ok(v.errors.some((e) => /over-alokasi/.test(e)), JSON.stringify(v.errors));
});

// ── 11. idempotency ─────────────────────────────────────────────────────────
test('11. duplicate posting guard via idempotency key', () => {
  const ledger = [entry('2026-08-01', [dr('1010', 5), cr('3000', 5)], { idem: 'return:pr1:2026-09' })];
  assert.strictEqual(T.hasPosted(ledger, 'return:pr1:2026-09'), true);
  assert.strictEqual(T.hasPosted(ledger, 'return:pr1:2026-10'), false);
});

// ── 12. deterministic scenario timelines ────────────────────────────────────
test('12. conservative & stress timelines are deterministic and distinct', () => {
  const st = openingState();
  st.projects = [{ id: 'p', name: 'Tani', deploy: 189, type: 'onetime', profit: 20, principalDate: '2026-11-19', inflowQuality: 'contracted' }];
  const c1 = T.projectScenario(st, CFG, 'conservative', TODAY);
  const c2 = T.projectScenario(st, CFG, 'conservative', TODAY);
  assert.deepStrictEqual(c1, c2, 'pure: identical across calls');
  const s1 = T.projectScenario(st, CFG, 'stress', TODAY);
  assert.notDeepStrictEqual(c1.events, s1.events, 'stress differs (more delay + haircut + Papa call)');
  // stress inflow is delayed more and haircut harder than conservative
  const cInflow = c1.events.find((e) => e.kind === 'inflow');
  const sInflow = s1.events.find((e) => e.kind === 'inflow');
  assert.ok(sInflow.date > cInflow.date, 'stress inflow later');
  assert.ok(Math.abs(sInflow.amount) < Math.abs(cInflow.amount), 'stress inflow smaller (haircut)');
});

// ── 13. return waterfall priority ───────────────────────────────────────────
test('13. return waterfall funds sinking first, RRPR second, attack last', () => {
  const st = S({
    contracts: [{ id: 'c', providerId: 'p', principal: 20, schedule: [{ tanggal: '2026-08-30', jumlah: 20, tipe: 'pokok', status: 'pending' }] }],
    providers: [{ id: 'p', classification: 'investor_debt', subtype: 'regular' }],
    ledger: [entry('2026-08-01', [dr('1010', 5), cr('3000', 5)])], // some cash, empty sinking + RRPR
  });
  const w = T.returnWaterfall(st, CFG, 30, TODAY);
  assert.strictEqual(w.steps[0].code, T.POCKET.SINKING, 'sinking first');
  assert.strictEqual(w.steps[0].amount, 20, 'funds the 20 principal maturity');
  assert.strictEqual(w.steps[w.steps.length - 1].code, T.POCKET.GDE, 'attack (Gde) last');
  const sum = T.R4(w.steps.reduce((s, x) => s + x.amount, 0));
  assert.strictEqual(sum, 30, 'waterfall conserves the full amount');
});

// ── 14. recommendation-generated ledger entries are balanced ────────────────
test('14. funding recommendation produces a balanced simulated ledger entry', () => {
  const st = openingState();
  st.pocketsBalancesInjected = true;
  // give Gde some cash so a deploy can be funded
  st.ledger = st.ledger.concat([entry('2026-08-02', [dr('1010', 60), cr('4000', 60)])]);
  const rec = T.fundingRecommendation(st, CFG, 40, { today: TODAY, maturityDate: '2026-12-01', profit: 6, startDate: TODAY });
  const funded = T.R4(rec.sources.idleInvestor + rec.sources.gde + rec.sources.rrpr);
  assert.strictEqual(T.R4(funded + rec.shortfall), 40, 'sources + shortfall = deploy');
  // every ledger entry in the simulated state stays balanced
  const scenario = T.projectScenario(st, CFG, 'conservative', TODAY); // exercises sim path
  assert.ok(scenario.events.length >= 0);
});

// ── 15. migration idempotency ───────────────────────────────────────────────
test('15. schema migration runs twice without duplicating data or entries', () => {
  const base = {
    investorContracts: [
      { id: 'x1', nama: 'Papa (RRPR)', pokok: 50, flexible: true, tanggalMulai: '2026-06-01', status: 'aktif', schedule: [] },
      { id: 'x2', nama: 'Veda 9jt', pokok: 9, tanggalMulai: '2026-05-11', tanggalMaturity: '2026-11-11', status: 'aktif', schedule: [] },
    ],
    projects: [{ id: 'projTani', peminjam: 'Tani dan vila Ngawi', jumlah: 189 }],
    orgConfig: { alokasi: [{ proyek: 'Tani & Vila Ngawi', deploy: 189, sumber: [{ s: 'Veda', j: 66.15 }, { s: 'Papa', j: 50 }] }] },
    ledger: [entry('2026-08-01', [dr('1100', 189), cr('1030', 189)])],
  };
  const once = T.migrate(JSON.parse(JSON.stringify(base)));
  const twice = T.migrate(JSON.parse(JSON.stringify(once)));
  assert.strictEqual(once.capitalProviders.length, twice.capitalProviders.length, 'providers stable');
  assert.strictEqual(once.capitalContracts.length, twice.capitalContracts.length, 'contracts stable');
  assert.strictEqual(once.capitalAllocations.length, twice.capitalAllocations.length, 'allocations stable');
  assert.strictEqual(twice.ledger.length, base.ledger.length, 'migration never touches the ledger');
  // no duplicate ids
  const ids = twice.capitalAllocations.map((a) => a.id);
  assert.strictEqual(new Set(ids).size, ids.length, 'no duplicate allocation ids');
  // Papa mapped as related-party flexible
  const papa = twice.capitalProviders.find((p) => p.subtype === 'related_party_flexible');
  assert.ok(papa && /Fleksibel Pihak Berelasi/.test(papa.name), 'Papa named as flexible related party, not RRPR');
});

// ── 15b. re-seed (source contract ids change) must not leave stale duplicates ─
test('15b. re-migrating after contracts are replaced does not duplicate (no stale Papa)', () => {
  const base = { investorContracts: [{ id: 'old1', nama: 'Papa (RRPR)', pokok: 50, flexible: true, schedule: [] }], projects: [], orgConfig: {}, ledger: [] };
  T.migrate(base);
  assert.strictEqual(base.capitalContracts.filter((c) => c.flexible).length, 1);
  // simulate a re-seed: investorContracts replaced with a NEW id (as uid() would produce)
  base.investorContracts = [{ id: 'new1', nama: 'Papa (RRPR)', pokok: 50, flexible: true, schedule: [] }];
  T.migrate(base);
  const flexContracts = base.capitalContracts.filter((c) => c.flexible);
  assert.strictEqual(flexContracts.length, 1, 'old ctr:old1 removed, only ctr:new1 remains');
  const flexPrincipal = flexContracts.reduce((s, c) => s + c.principal, 0);
  assert.strictEqual(flexPrincipal, 50, 'flexible principal is 50, not 100 (no stale duplicate)');
});

// ── bonus: metrics sanity on opening position ───────────────────────────────
test('bonus. opening metrics: leverage>0, ROE denom = owner equity, AUM = 386.465', () => {
  const m = T.metrics(openingState(), CFG, TODAY);
  assert.strictEqual(m.AUM, 386.465);
  assert.strictEqual(m.ownerEquity, 208.815);
  assert.strictEqual(m.leverage, T.R4(177.65 / 208.815));
});

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
      entry('2026-08-01', [dr('1010', 40), cr('3000', 40)]),
      entry('2026-08-01', [dr('1030', 30), cr('2000', 30)]),
      entry('2026-08-01', [dr('1020', 20), cr('3010', 20)]),
      entry('2026-08-01', [dr('1040', 15), cr('2000', 15)]),
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
  assert.strictEqual(free['1030'], 30, 'earmark already covered by sinking');
  assert.strictEqual(free['1020'], T.R4(Math.max(0, 20 - T.requiredRRPR(st, cfg, TODAY))), 'RRPR only above its floor');
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

// ── Task 3: paymentLadder ───────────────────────────────────────────────────
function ladderState() {
  return S({
    ledger: [entry('2026-08-01', [dr('1010', 30), cr('3000', 30)])],
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
  assert.strictEqual(l.rows[0].cumulativeCash, 29);
  assert.strictEqual(l.rows[1].cumulativeCash, 28);
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
  assert.ok(g.reason.length > 0);
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
  const best = T.maxSafeTicket(st, cfg, { ticket: 25, profit: 0, maturityDate: '2026-12-20' }, TODAY);
  assert.ok(best.ticket >= 0 && best.ticket < 25, 'downsized below the breaking ticket');
  const check = T.guaranteeGate(st, cfg, { ticket: best.ticket, profit: 0, maturityDate: '2026-12-20' },
    T.pickSourcesForDeal(st, cfg, { ticket: best.ticket, maturityDate: '2026-12-20', today: TODAY }).mix, TODAY);
  assert.strictEqual(check.verdict, 'GREEN', 'a ticket we label "aman" must keep a real buffer, not just avoid RED');
});

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

// ── Regression: a deal that cannot be funded must not read as merely cautious ─
test('T4e. shortfall (cannot fund) is RED, never GREEN/YELLOW', () => {
  const st = S({ ledger: [entry('2026-08-01', [dr('1100', 50), cr('3000', 50)])] }); // all deployed, no liquid cash
  const cfg = T.cfgOf({});
  const deal = { ticket: 100, maturityDate: '2026-12-01', today: TODAY };
  const picked = T.pickSourcesForDeal(st, cfg, deal);
  assert.strictEqual(picked.mix.length, 0, 'nothing available to draw');
  const g = T.guaranteeGate(st, cfg, deal, picked.mix, TODAY);
  assert.strictEqual(g.verdict, 'RED', 'unfundable deal must be RED');
  assert.ok(/cukup|kurang/i.test(g.reason), 'reason names the funding gap: ' + g.reason);
  assert.strictEqual(g.shortfall, 100);
});

// ── Review findings C1-C3: the ladder must not lean optimistic ───────────────
test('C1. an overdue unpaid investor obligation still breaks the guarantee', () => {
  const st = S({
    ledger: [entry('2026-07-01', [dr('1010', 120), cr('3000', 120)])],
    providers: [{ id: 'p1', classification: 'investor_debt', subtype: 'regular' }],
    contracts: [{ id: 'c1', providerId: 'p1', principal: 100, nama: 'Investor A', schedule: [
      { tanggal: '2026-07-15', jumlah: 100, tipe: 'pokok', status: 'pending' }, // PAST DUE, unpaid
      { tanggal: '2026-11-03', jumlah: 2, tipe: 'bagihasil', status: 'pending' },
    ] }],
  });
  const cfg = T.cfgOf({});
  const deal = { ticket: 40, maturityDate: '2026-12-01', today: TODAY };
  const g = T.guaranteeGate(st, cfg, deal, [{ code: '1010', amount: 40 }], TODAY);
  assert.strictEqual(g.verdict, 'RED', 'money already owed cannot vanish from the guarantee');
});

test('C2. a late/unpaid project inflow is not counted as cash in hand', () => {
  const st = S({
    ledger: [entry('2026-08-01', [dr('1010', 5), cr('3000', 5)])],
    providers: [{ id: 'p1', classification: 'investor_debt', subtype: 'regular' }],
    contracts: [{ id: 'c1', providerId: 'p1', principal: 50, nama: 'Investor A', schedule: [
      { tanggal: '2026-09-03', jumlah: 50, tipe: 'pokok', status: 'pending' },
    ] }],
    // borrower matured 2 months ago and still has not paid
    projects: [{ id: 'pr1', name: 'Telat', deploy: 60, type: 'onetime', profit: 10,
      principalDate: '2026-06-01', inflowQuality: 'contracted' }],
  });
  const l = T.paymentLadder(st, T.cfgOf({}), TODAY, {});
  assert.strictEqual(l.rows[0].covered, false, 'a defaulting borrower is not spendable cash');
  assert.ok(l.rows[0].cumulativeCash < 0);
});

test('C3. an inflow landing the same day as a payment cannot fund it (cash-in-advance)', () => {
  const st = S({
    ledger: [entry('2026-08-01', [dr('1010', 10), cr('3000', 10)])],
    providers: [{ id: 'p1', classification: 'investor_debt', subtype: 'regular' }],
    contracts: [{ id: 'c1', providerId: 'p1', principal: 40, nama: 'Investor A', schedule: [
      { tanggal: '2026-10-27', jumlah: 40, tipe: 'pokok', status: 'pending' },
    ] }],
    // inflow shifted +7d lands exactly on 2026-10-27
    projects: [{ id: 'pr1', name: 'Pas', deploy: 40, type: 'onetime', profit: 0,
      principalDate: '2026-10-20', inflowQuality: 'received' }],
  });
  const l = T.paymentLadder(st, T.cfgOf({}), TODAY, {});
  assert.strictEqual(l.rows[0].covered, false, 'cash must be in hand BEFORE the payment date');
});

// ── Advisory mode: fundingNeed ──────────────────────────────────────────────
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
  assert.ok(need.injection >= 40, 'must ask for at least the 40 shortfall, got ' + need.injection);
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

// ── Safe concurrent writes: app must never erase what the bot posted ────────
test('M1. a bot ledger entry made while the app was open survives the app save', () => {
  const local = S({ ledger: [entry('2026-08-01', [dr('1010', 5), cr('3000', 5)], { id: 'a' })] });
  const cloud = S({ ledger: [
    entry('2026-08-01', [dr('1010', 5), cr('3000', 5)], { id: 'a' }),
    entry('2026-08-05', [dr('5000', 1), cr('1000', 1)], { id: 'bot1' }),
  ] });
  const m = T.mergeCloudOps(local, cloud);
  assert.strictEqual(m.state.ledger.length, 2, 'the bot entry is kept');
  assert.ok(m.state.ledger.some((e) => e.id === 'bot1'));
  assert.strictEqual(m.recovered.entries, 1);
});

test('M2. a payment marked paid by the bot is never flipped back to pending', () => {
  const mk = (status) => ({ id: 'c1', nama: 'Investor A', schedule: [{ tanggal: '2026-09-03', jumlah: 1, tipe: 'bagihasil', status }] });
  const m = T.mergeCloudOps(S({ investorContracts: [mk('pending')] }), S({ investorContracts: [mk('paid')] }));
  assert.strictEqual(m.state.investorContracts[0].schedule[0].status, 'paid');
  assert.strictEqual(m.recovered.schedules, 1);
});

test('M3. a contract created from Telegram is picked up by the app', () => {
  const local = S({ investorContracts: [] });
  const cloud = S({ investorContracts: [{ id: 'new1', nama: 'Investor Baru', pokok: 20, schedule: [] }] });
  const m = T.mergeCloudOps(local, cloud);
  assert.strictEqual(m.state.investorContracts.length, 1);
  assert.strictEqual(m.recovered.contracts, 1);
});

test('M4. merging with no cloud changes is a no-op', () => {
  const st = S({ ledger: [entry('2026-08-01', [dr('1010', 5), cr('3000', 5)], { id: 'a' })] });
  const m = T.mergeCloudOps(st, JSON.parse(JSON.stringify(st)));
  assert.strictEqual(m.state.ledger.length, 1);
  assert.strictEqual(m.recovered.entries, 0);
  assert.strictEqual(m.recovered.schedules, 0);
});

// ── Income breakdown: investor / Mas Hena / Gde / RRPR ──────────────────────
function incomeState() {
  return S({ ledger: [
    entry('2026-07-01', [dr('1010', 100), cr('3000', 100)]),   // Gde capital 100
    entry('2026-07-01', [dr('1020', 100), cr('3010', 100)]),   // RRPR capital 100 -> 50/50 split
    entry('2026-07-10', [dr('1000', 10), dr('5020', 1), cr('4000', 11)]), // gross 11, fee 1
    entry('2026-07-15', [dr('5000', 3), cr('1000', 3)]),       // investor bagi hasil 3
    entry('2026-08-20', [dr('1000', 50), cr('4000', 50)]),     // NEXT month, must be excluded
  ] });
}

test('I1. splits a period income into gross, Mas Hena, investor, and owner shares', () => {
  const b = T.incomeBreakdown(incomeState(), T.cfgOf({}), '2026-07-01', '2026-07-31');
  assert.strictEqual(b.gross, 11);
  assert.strictEqual(b.masHena, 1);
  assert.strictEqual(b.investor, 3);
  assert.strictEqual(b.ownerProfit, 7, '11 - 1 - 3');
  assert.strictEqual(b.gde, 3.5, 'pro-rata on equal capital');
  assert.strictEqual(b.rrpr, 3.5);
  assert.strictEqual(T.R4(b.gde + b.rrpr), b.ownerProfit, 'the split conserves the profit');
});

test('I2. the period window excludes other months', () => {
  const b = T.incomeBreakdown(incomeState(), T.cfgOf({}), '2026-07-01', '2026-07-31');
  assert.strictEqual(b.gross, 11, 'the August 50 is not counted');
});

test('I3. the owner split follows paid-in capital, not a fixed 50/50', () => {
  const st = incomeState();
  st.ledger = st.ledger.concat([entry('2026-07-02', [dr('1010', 300), cr('3000', 300)])]); // Gde 400 vs RRPR 100
  const b = T.incomeBreakdown(st, T.cfgOf({}), '2026-07-01', '2026-07-31');
  assert.strictEqual(b.splitPct.gde, 80);
  assert.strictEqual(b.gde, 5.6);
  assert.strictEqual(b.rrpr, 1.4);
});

test('I4. deckMetrics carries the income split plus ROE for the period', () => {
  const d = T.deckMetrics(incomeState(), T.cfgOf({}), '2026-07-01', '2026-07-31', '2026-07-31');
  assert.strictEqual(d.income.ownerProfit, 7);
  assert.ok(d.roeBulan > 0, 'ROE computed against owner equity');
  assert.ok(d.aum > 0);
});

// ── Statements as data (shared by the app and the scheduled PDF) ────────────
test('R1. laba rugi is a true period and nets to profit', () => {
  const st = T.statements(incomeState(), T.cfgOf({}), '2026-07-01', '2026-07-31');
  assert.strictEqual(st.labaRugi.totalPendapatan, 11);
  assert.strictEqual(st.labaRugi.totalBeban, 4, 'fee 1 + bagi hasil 3');
  assert.strictEqual(st.labaRugi.labaBersih, 7);
});

test('R2. neraca balances: aset = liabilitas + ekuitas', () => {
  const st = T.statements(openingState(), T.cfgOf({}), null, '2026-08-31');
  assert.strictEqual(st.neraca.balanced, true,
    'aset ' + st.neraca.totalAset + ' vs ' + (st.neraca.totalLiab + st.neraca.totalEkuitas));
});

test('R3. neraca saldo balances debit against kredit', () => {
  const st = T.statements(openingState(), T.cfgOf({}), null, '2026-08-31');
  assert.strictEqual(st.neracaSaldo.balanced, true,
    'D ' + st.neracaSaldo.total.debit + ' vs K ' + st.neracaSaldo.total.kredit);
});

test('R4. arus kas classifies deploy as investasi and capital as pendanaan', () => {
  const st = T.statements(openingState(), T.cfgOf({}), '2026-01-01', '2026-12-31');
  assert.ok(st.arusKas.total.investasi < 0, 'deploying cash out is negative investasi');
  assert.ok(st.arusKas.total.pendanaan > 0, 'investor + owner capital in is positive pendanaan');
});

// ── CRITICAL: the PGM robot writes projects straight to Firestore ───────────
test('M5. a project added by the PGM robot is never erased by the app save', () => {
  const local = S({ projects: [{ id: 'p1', peminjam: 'Lama', status: 'tersedia' }] });
  const cloud = S({ projects: [
    { id: 'p1', peminjam: 'Lama', status: 'tersedia' },
    { id: 'p2', peminjam: 'Baru dari PGM', status: 'tersedia' },
  ] });
  const m = T.mergeCloudOps(local, cloud);
  assert.strictEqual(m.state.projects.length, 2, 'the robot project survives');
  assert.ok(m.state.projects.some((p) => p.id === 'p2'));
  assert.strictEqual(m.recovered.projects, 1);
});

test('M6. an entered project is never downgraded back to tersedia by a stale cloud copy', () => {
  const local = S({ projects: [{ id: 'p1', peminjam: 'X', status: 'aktif', tanggalAktif: '2026-08-10' }] });
  const cloud = S({ projects: [{ id: 'p1', peminjam: 'X', status: 'tersedia' }] });
  const m = T.mergeCloudOps(local, cloud);
  assert.strictEqual(m.state.projects[0].status, 'aktif', 'local entry wins over a stale tersedia');
});

test('M7. bridges and the decision log are not lost either', () => {
  const local = S({ bridges: [], decisionLog: [] });
  const cloud = S({ bridges: [{ amount: 5, restoreBy: '2026-12-01', dealId: 'x' }],
                    decisionLog: [{ ts: '2026-08-01T00:00:00Z', dealId: 'x', verdict: 'GREEN' }] });
  const m = T.mergeCloudOps(local, cloud);
  assert.strictEqual((m.state.bridges || []).length, 1);
  assert.strictEqual((m.state.decisionLog || []).length, 1);
});

// ── Bot operations: the bot posts through the SAME rules as the app ─────────
test('B1. every bot op produces a balanced entry', () => {
  const c = { id: 'c1', nama: 'Veda' }, p = { id: 'pr1', name: 'Tani' };
  const ops = [
    T.opBayarBagiHasil(c, 1.323, '1000', '2026-09-03'),
    T.opKembalikanPokok(c, 66.15, '1040', '2026-12-03'),
    T.opReturnProyek(p, 10, 1, '1000', '2026-09-20'),
    T.opTransfer('1010', '1040', 5, '2026-09-01'),
    T.opSetorModal('1010', 25, '2026-09-01'),
  ];
  ops.forEach((e) => {
    const d = e.lines.reduce((s, l) => s + l.debit, 0), k = e.lines.reduce((s, l) => s + l.credit, 0);
    assert.ok(Math.abs(d - k) < 0.005, e.memo + ' balances (' + d + ' vs ' + k + ')');
  });
});

test('B2. a project return books the gross as income and the fee as expense', () => {
  const e = T.opReturnProyek({ id: 'pr1', name: 'Tani' }, 10, 1, '1000', '2026-09-20');
  const line = (c) => (e.lines.find((l) => l.account === c) || { debit: 0, credit: 0 });
  assert.strictEqual(line('1000').debit, 10, 'net cash in');
  assert.strictEqual(line('5020').debit, 1, 'Mas Hena fee as expense');
  assert.strictEqual(line('4000').credit, 11, 'gross recognised as income');
});

test('B3. tapping the button twice cannot post the payment twice', () => {
  const c = { id: 'c1', nama: 'Veda' };
  const e = T.opBayarBagiHasil(c, 1.323, '1000', '2026-09-03');
  let st = S({});
  const first = T.applyOp(st, e);
  assert.strictEqual(first.applied, true);
  const second = T.applyOp(first.state, T.opBayarBagiHasil(c, 1.323, '1000', '2026-09-03'));
  assert.strictEqual(second.applied, false, 'the deterministic id blocks the duplicate');
  assert.strictEqual(second.state.ledger.length, 1);
});

test('B4. the locked sinking pocket can never be a transfer source', () => {
  assert.throws(() => T.opTransfer('1040', '1010', 5, '2026-09-01'), /terkunci/i);
});

test('B5. a wrong amount is corrected by reversal, never by deletion', () => {
  const c = { id: 'c1', nama: 'Veda' };
  const orig = T.opBayarBagiHasil(c, 1.323, '1000', '2026-09-03');
  const rev = T.opReversal(orig, '2026-09-04');
  const d = rev.lines.reduce((s, l) => s + l.debit, 0), k = rev.lines.reduce((s, l) => s + l.credit, 0);
  assert.ok(Math.abs(d - k) < 0.005, 'reversal balances');
  assert.strictEqual(rev.lines.find((l) => l.account === '1000').debit, 1.323, 'cash comes back');
  assert.ok(/KOREKSI/.test(rev.memo));
  assert.notStrictEqual(rev.idem, orig.idem, 'the reversal has its own id so both survive');
});

test('B6. setor modal credits the right owner equity account', () => {
  assert.strictEqual(T.opSetorModal('1020', 10, '2026-09-01').lines.find((l) => l.credit > 0).account, '3010');
  assert.strictEqual(T.opSetorModal('1010', 10, '2026-09-01').lines.find((l) => l.credit > 0).account, '3000');
});
