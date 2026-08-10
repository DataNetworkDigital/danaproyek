# DanaTrack — Smart Deal Intake + Investor-Payment Guarantee

Status: approved-direction (2026-08-03). Builds on the treasury-v4 engine
(`treasury.js`) already shipped. Owner: Gde. App: single-file `index.html` +
`treasury.js`, Firestore `danatrack/main_data`, GitHub Pages.

Research backing: two multi-agent research passes (liability-driven treasury +
deal-intake UX); their conclusions are distilled inline throughout this spec.

---

## 1. Goal (in the user's words)

When a new borrower deal shows up, the app should **tell Gde which cash to use**,
and **guarantee every investor return + principal stays payable on its date**.
The guarantee is the top priority. Gde focuses on securing deals; the app does
the treasury thinking and the accounting.

Real-world flow (confirmed): a partner "PGM" auto-posts borrower projects into
DanaTrack (external n8n robot writes straight to Firestore as `status:tersedia`,
plus a Telegram ping). Gde does not enter deals by hand. He opens the app,
picks an available project, and the app runs the funding + safety flow.

---

## 2. Locked decisions (from brainstorming)

- **Guarantee semantics:** hard warning + reasoned override, never a silent
  breach. A deal that breaks a payment date is flagged RED and names the exact
  obligation + date; Gde can still proceed by typing a reason (supports
  warehouse-then-syndicate).
- **What counts as "sure cash":** conservative only. Cash already in a pocket +
  scheduled project returns (shifted +7 days, haircut). **Never** count investor
  money not yet raised. The guarantee is only trustworthy if it excludes hoped-for
  money.
- **Reserve posture:** rolling, safe-but-not-wasteful. Pre-fund investor
  obligations due within a configurable window (default 60 days), sized
  per-maturity, filled automatically from incoming project returns. Not all cash
  locked.
- **Funding order (default):** idle investor money first (stop the 2% idle bleed),
  then Gde capital, then RRPR only as a flagged emergency bridge. Configurable.
- **Tiered project return:** new projects default to 5.5%/mo for months 1-3 and
  6.5%/mo for months 4-6, cycling every 6 months. Per-project customizable.
- **No manual-entry provenance label** (Gde ~never inputs by hand).
- **Ingestion (PGM → system) is out of scope** — handled by the external robot.

---

## 3. Core principle: two engines, kept separate

The single most important architectural rule (from research): **do not fuse the
"pick a source" step with the "is it safe" step.**

1. `pickSourcesForDeal(state, cfg, deal)` — a deterministic **waterfall** that
   proposes a pocket mix by drawing the attack line in priority order.
2. `guaranteeGate(state, cfg, deal, mix)` — a forward-looking **veto** that
   re-runs the dated stress ladder with the deal applied and passes only if every
   investor obligation date stays cash-covered.

`pickSources` proposes; `guaranteeGate` can reject or force a downsize. Fusing
them is the classic way a locally-sensible draw silently eats cash earmarked for
a maturity three weeks out.

### 3.1 The guarantee is cash-on-the-date, not value

Solvent-on-paper still defaults if the cash is not in the right pocket on the
right day (the 2022 LDI lesson). The gate is defined only on **projected
cash-on-hand in payable pockets on each obligation date**, under the stress
scenario (project inflows +7 days, investor outflows on due date). No PV, no
total-assets test.

### 3.2 Non-negotiable invariants

- Sinking pocket `1040` (Investor Jatuh Tempo) is **locked**: excluded from every
  source list, even "last resort". The moment its cash can fund a deal, the
  principal guarantee is fiction.
- Idle investor pocket `1030` is drawn only on its **net-of-earmark** free
  balance: subtract investor obligations due inside the window not yet sunk into
  `1040`. "Idle dry powder" must never cannibalize a near maturity.
- RRPR `1020` is a fire-break, not a funding line: offered only after `1030` and
  `1010` are exhausted, only as a flagged **bridge** down to its floor, and only
  with a mandatory **restore-by date** registered on the ladder. Any RRPR draw
  forces at least a YELLOW state.
- Owner spread (Gde profit) is the **residual** claim: a cash-trap suppresses
  owner draws until all window obligations are cash-covered and RRPR + sinking
  are at target.
- **Recompute the whole ladder on every state change** — new deal, new investor,
  new payment, and on load. A matched book silently decays otherwise.
- **Deterministic arithmetic only.** No duration/convexity/Monte-Carlo/ML. Borrow
  the discipline (waterfall, buffer, cushion, cash-trap), not the quant math.
  Anything heavier is over-engineering for a one-account solo fund.

---

## 4. Engine design (additions to `treasury.js`, pure + tested)

All new functions are pure `(state, cfg, ...) -> data`, no DOM. They extend the
existing engine (which already has `projectScenario`, `requiredRRPR`,
`fundingRecommendation`, `returnWaterfall`, `maturityLadder`).

### 4.1 Config additions (`orgConfig.treasury`)

```
fundingOrder: ['1030','1010','1020']   // idle investor, Gde, RRPR(bridge)
pocketFloors: { '1000': operatingFloor, '1020': rrprFloor }  // rrprFloor = requiredRRPR
hardGuaranteeWindowDays: 60            // near-window for earmarks + sinking pre-fund
timingBufferDays: 7                    // minBuffer basis
singleBorrowerCapPct: 40               // concentration cap vs liquid cash (warn)
tieredReturn: { m1_3: 5.5, m4_6: 6.5, cycleMonths: 6, feePct: 0.5 }
ownerCashTrap: true
```

### 4.2 `freeCashByPocket(state, cfg, today)`

Per-pocket spendable cash:
- `1010` (Gde): full balance.
- `1030` (idle investor): balance − (investor obligations due ≤ window not yet
  staged in `1040`).
- `1020` (RRPR): balance − `rrprFloor` (bridge capacity only).
- `1040`: always 0 (locked).
- `1000` (Utama): balance − operatingFloor (transit hub, not a real source).

### 4.3 `pickSourcesForDeal(state, cfg, deal)`

Draw `deal.ticket` from `fundingOrder`, each pocket down to its floor before
spilling to the next; stop when the ticket is met. RRPR draws are flagged
`bridge:true` with `restoreBy = deal.maturityDate` (we never bank on an assumed
future raise — counting on that is the Ponzi-adjacent trap). Returns
`{ mix:[{code,amount,bridge?}], shortfall }`.

### 4.4 `paymentLadder(state, cfg, today, {deal, mix})`

The heart of the guarantee. Builds the dated ladder of every future investor
obligation (bagi hasil + pokok from `investorContracts`, incl. Papa scenario
call) vs stressed inflows, with the proposed deal applied (cash out now, deal
inflows added at date+7 using tiered-return amounts). For each obligation date
`d`: `cumulativeCash(d) = startPayableCash + Σ(stressed inflows date+7 ≤ d) −
Σ(investor outflows dueDate ≤ d)`. Returns per-date rows
`{date, obligation, kind, cumulativeCash, covered:boolean, tight:boolean}` and
the min gap. `minBuffer = timingBufferDays × avgDailyObligationOutflow`.

### 4.5 `guaranteeGate(...)` → verdict

- **GREEN (AMAN):** every `cumulativeCash(d) ≥ minBuffer`.
- **YELLOW (HATI-HATI):** all dates covered but min gap < cushion, or an RRPR
  bridge is used, or single-borrower exposure > cap.
- **RED (TIDAK AMAN):** some date breaks; verdict names the first failing
  obligation + date.

### 4.6 `maxSafeTicket(state, cfg, deal)`

When the full ticket is RED, binary-search the largest `T*` keeping every ladder
cell ≥ minBuffer (min-gap is monotonic in ticket). Return `T*` + the breaking
date + concrete fix ("naikkan investor Rp Y sebelum tgl Z, atau kecilkan tiket
ke T*").

### 4.7 `enterDeal(state, cfg, deal, mix, {reasonOverride?})` (side-effecting, called only on confirm)

Posts the balanced deploy entry(ies) from the chosen pockets, flips the project
`tersedia → aktif`, sets `tanggalAktif`, generates its tiered-return schedule,
registers any RRPR bridge obligation, and records a decision-log entry
(recommended vs chosen + verdict snapshot + reason). Returns a reversible
handle: `undoEnterDeal(handle)` reverses the postings + status while nothing has
left the bank.

### 4.8 Tiered-return schedule generation

`buildTieredSchedule(deploy, startDate, tenor, cfg.tieredReturn)` → monthly gross
returns (5.5% months 1-3, 6.5% months 4-6, cycling every `cycleMonths`), net of
`feePct` (Mas Hena). Feeds both the project card and the ladder inflows. Existing
projects keep their current schedule (migration leaves them untouched).

### 4.9 Return waterfall + owner cash-trap (extends existing `returnWaterfall`)

On each incoming return: (1) top sinking `1040` to cover per-maturity obligations
in the window, (2) restore RRPR to floor, (3) then, only if all senior
obligations are covered and reserves at target, mark the remainder
owner-distributable. If `ownerCashTrap` and the forward buffer is thin, owner
draw is suppressed and surfaced as "ditahan sementara".

### 4.10 Tests (node --test, extends the existing 18)

Cash-on-date breach detection; sinking excluded from sources; idle-net-of-earmark;
RRPR bridge forces YELLOW + restore-by; owner cash-trap suppresses draw when thin;
tiered-return schedule (5.5→6.5 cycle, fee netted); `maxSafeTicket` monotonic +
correct breaking date; per-date payability proof; deal maturity after an investor
principal date flags mismatch; same-day inflow cannot fund same-day outflow;
new-investor-mid-book turns green→yellow; enterDeal/undoEnterDeal round-trips
balanced.

---

## 5. Intake UX / flow design

### 5.1 Information architecture (no new tab)

`tersedia` and `aktif` are two states of one project object, so Peluang is a
**segment of the existing Proyek tab**, not a 5th nav tab or separate inbox.

- Proyek tab gets a `.seg` segmented control: **[ Peluang · Aktif · Selesai ]**
  (Peluang = `status:tersedia`, default segment when there are unseen items).
- Proyek nav icon carries a small purple **count badge** = number of unseen
  `tersedia` items.
- Ringkasan (home) gets one calm entry card near the top: **"Peluang baru (N)"**
  → deep-links to Proyek→Peluang. This card is the durable in-app notification
  surface; it must read well even if Gde never taps a Telegram ping.
- A prominent **"Masuk project"** button (on Ringkasan + top of Proyek→Peluang)
  is the explicit entry Gde asked for: it opens the searchable Peluang list.

### 5.2 Telegram → app deep-link

The Telegram ping is a transient pointer, not the decision. It opens the plain
web URL `…/danaproyek/?peluang=<id>` (NOT Telegram `?startapp=`, which is
unreliable on iOS/macOS), which routes Proyek→Peluang→that item's detail sheet
with "Masuk project" in reach. Opening the item (from Telegram or in-app) clears
its unseen dot — shared seen-state, never double-nags. (Wiring the robot to send
this URL is a one-line n8n change, noted for Gde; not app work.)

### 5.3 Peluang list + card

- Searchable list (search box: "Cari project atau peminjam"), one vertical ranked
  column — no kanban, no board, no horizontal scroll.
- Reuse the existing `.pc.tersedia` clay card (cream gradient, `--clay-out-orange`
  shadow, 24px radius). Card shows ≤6 facts: name (Nunito 700) + amount (Geist
  Mono, the big number); light secondary row: tenor, expected return, one
  **deadline chip**. Amber `TERSEDIA` pill top-right.
- **All funding math stays OFF the card** — the analysis lives behind the tap.
  This is the biggest scannability lever.
- **Default sort by urgency:** soonest commitment deadline first, then freshest,
  amount as tiebreak. A subtle "perlu perhatian" marker on only the top 1-3.
- Deadline chip color: neutral normally, amber < 48h, red only for expired.
- Unseen purple dot, cleared on open. Tap → detail `.mo`/`.modal` sheet.

### 5.4 Decide-to-enter flow (progressive disclosure)

1. **Detail sheet** — tapping a card opens the bottom sheet: full opportunity
   (borrower, amount, tenor, expected return, expandable "lihat detail dari PGM").
   Primary CTA: **"Masuk project"**. No funding math yet.
2. **Dry-run** — tapping "Masuk project" runs `pickSources` + `paymentLadder` +
   `guaranteeGate` locally (instant). Show an honest ~300-500ms beat ("Mengecek
   kas & jadwal balik…") — a healthy pause before committing money, not fake
   latency.
3. **Decision screen** — the GO/NO-GO. Top: ONE plain-language verdict chip
   (AMAN / HATI-HATI / TIDAK AMAN, with the covered-until date or the failing
   obligation + date). Then:
   - Recommended pocket mix, pre-filled, with a one-line plain rationale.
   - Before→after balance per affected pocket (Geist Mono, "Gde Rp80jt → Rp30jt")
     + an exposure line ("project ini = 42% kas likuid").
   - **Payability proof:** the nearest investor obligations (from
     `investorContracts`), each shown covered ✓ / tight / at-risk on its date
     after this deploy. This visible proof is what earns trust.
   - **Editable:** Gde can adjust pocket amounts; verdict + payability recompute
     live.
4. **Confirm** — action-specific primary: **"Masuk project — danai Rp50jt dari 3
   kantong"** + easy safe secondary **"Belum, simpan dulu"**. Back/close = the
   safe path (never triggers commit). A RED verdict hard-gates the primary
   (requires an explicit override tap + typed reason).
5. **Side effects fire ONLY on confirm:** `tersedia → aktif`, post ledger
   allocation, (robot/Telegram notify PGM is Gde's n8n hook). Then a **receipt**:
   "Project [nama] AKTIF", amount + pockets used, next return due date.
6. **Undo** — reuse `toast()` with an inline **"Batalkan"** for a real
   multi-second window that reverses the postings + status (nothing has left the
   bank yet). State reversibility honestly; never imply an undo that isn't real.

### 5.5 States (colors consistent list ↔ decision)

- Safe: `--clay-out-green` + `#16a34a`. Warning: `--clay-out-orange` + `#B45309`.
  Blocked: `--clay-out-red` + `#B42318`.
- Empty Peluang: calm success, not error — "Belum ada peluang baru · Kami kabari
  lewat Telegram kalau PGM posting proyek."
- Stale deep-link: open the detail but show "Peluang ini sudah tidak tersedia" +
  one-tap "lihat peluang lain". Never a 404/blank sheet.

### 5.6 Anti-overwhelm (explicit non-goals)

Exactly ONE confirmation checkpoint (no stacked "yakin?" modals — they train
click-through). No type-to-confirm / hold-to-confirm (too heavy for one's own
fund). No kanban, saved views, personalization, or heavy filter drawers
(meaningless for <10 items on a phone). Reuse existing primitives
(`.pc.tersedia`, `.bdg`, `.seg`, `.mo`/`.modal`, `toast()`, the pocket +
investor-schedule engines) so the feature feels native and adds little new
surface.

---

## 6. Design polish (Emil principles, adapted to vanilla)

- Press feedback: `transform: scale(0.97)` on `:active` for cards/buttons,
  `transition: transform 160ms ease-out`.
- Custom ease-out for enters (`cubic-bezier(0.23,1,0.32,1)`); sheet uses the
  drawer curve (`cubic-bezier(0.32,0.72,0,1)`); all UI transitions < 300ms.
- Detail/decision sheet enters from the trigger, not scale(0); `@starting-style`
  or the existing `cardIn` pattern.
- Verdict color change uses a short crossfade; no jarring instant swap.
- Respect `prefers-reduced-motion` (the app already reduces transitions).
- Numbers always rounded; money via the existing `fj`/Geist Mono.

---

## 7. Data model deltas (additive, non-destructive)

- Project (opportunity) gains optional fields: `deadline` (commitment deadline
  chip), `seen` (unseen dot), `returnTier` (tiered config; default from
  `orgConfig.treasury.tieredReturn`). All optional — existing projects unaffected.
- `orgConfig.treasury` gains the §4.1 keys (migration seeds defaults).
- RRPR bridge obligations: a small `S.bridges:[{amount, restoreBy, dealId}]`
  registered on entry, shown on the ladder + Treasury, cleared on refill.
- Decision log: `S.decisionLog:[{ts, dealId, recommended, chosen, verdict,
  reason?}]` — lightweight audit trail.

---

## 8. Edge cases (must handle)

Lumpy same-month principal maturities (size sinking per-maturity, not average);
borrower early repayment → re-match freed cash immediately; investor rollover →
treat maturity as real cash-out unless a per-investor "committed rollover" toggle
is set; new investor mid-book → recompute ladder + RRPR floor; partial funding →
offer `T*` + breaking date; disburse + first inflow straddling a coupon date →
place both correctly on the ladder; project outright default → separate scenario
that zeroes one borrower and checks Tier-1 coverage (concentration cushion);
zero-yield idle money → surface it already owes 2%/mo; RED-state lockdown → block
new-deal intake, route to refill/raise; same-day inflow cannot fund same-day
outflow (cash-in-advance).

---

## 9. Risks + guardrails

- **Correctness > polish.** A wrong green light on real money destroys trust
  permanently. The payability check must read the real `investorContracts`
  schedule + real pocket balances, honor the funding order, and never touch
  `1040`. Spend effort here first.
- **No dark patterns**, even in a solo tool: don't auto-focus commit, don't hide
  the safe path, Back never commits.
- **No automation bias:** always show the per-obligation proof + editable
  override, never just "use Pocket A + C ✅".
- **Ponzi-adjacent drift:** trace the SOURCE of every investor payment; flag any
  not backed by genuine project cash. Never count unraised investor money.
- **Notification noise:** Telegram push only for genuinely fundable new
  opportunities; batch bursts into one message.
- **Over-engineering:** no quant math, no kanban, no multi-entity pooling. Keep it
  a dated ladder + waterfall + reserve.

---

## 10. Milestones (each testable + independently shippable)

1. **Engine** — §4 functions + tests (pure, node --test). No UI. Zero risk.
2. **Peluang segment + list** — Proyek `.seg` [Peluang·Aktif·Selesai], searchable
   list, Ringkasan "Peluang baru" card, unseen dot, `?peluang=` deep-link.
3. **Decide-to-enter flow** — detail sheet → dry-run → decision screen (verdict +
   mix + before/after + payability proof + editable) → confirm → receipt → undo.
4. **Return waterfall + owner cash-trap + RRPR bridge tracking** wired into Inbox
   + Treasury.
5. **Tiered-return** default in the project form + schedule generation.
6. **Polish pass** (Emil motion, states, empty/stale) + full preview smoke.

Deploy per milestone (branch → verify → merge if green), same discipline as
treasury-v4.

---

## 11. Non-goals (this spec)

PGM ingestion / scraping (external robot); the n8n Telegram-URL change (one-liner
Gde owns); Firebase Auth activation (separate, already staged); any change to the
already-shipped treasury-v4 reports/accounting.
