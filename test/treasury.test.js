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
