# DanaTrack — PRODUCT.md

> Strategic context for design decisions. Read by impeccable skill.

## Register

`product` — design serves the product (app UI, dashboard, tool).

## Product Purpose

DanaTrack is a personal investment management platform for Indonesian individual investors managing **dana talangan** (bridge loan) capital across multiple short-term projects (1-12 months).

The app tracks:
- **Projects**: who borrowed money, contract value, deploy amount, return schedule, status
- **Investors**: external parties contributing capital with allocation per project
- **Documents**: legally-binding investment contracts auto-generated from project data
- **Cash position**: KUR (bank loan) interest, daily living expenses, available capital

**Two audiences in one app** (PIN-gated):
1. **Public/Investor view** — sees curated info: portfolio active, projected returns, project list with sanitized statuses (no "Tidak Terambil", no "Terlambat")
2. **Admin view** — sees everything: real profit margins, payment delays, fund management, document generation

## Users

### Primary: Pengelola Dana (you, the operator)
- Indonesian, fluent in basic English fintech terms
- Manages 8-15 active projects at any time
- Daily check-ins on payment status, weekly reviews
- Pain: needs to switch between "investor presentation mode" and "operations mode" quickly
- Mobile-first usage (90%+), occasional desktop for document generation

### Secondary: Investor Pribadi
- Family/close-network investors (3-10 people) trusting capital to operator
- Each holds Rp 10jt – Rp 500jt in active deployment
- Wants confidence the money is working, not granular detail
- Checks app monthly, not daily
- Needs perceived professionalism to maintain trust over years

## Brand

### Tone
- **Calm** — never urgent, never excited
- **Confident** — states facts, doesn't hedge
- **Indonesian-primary** — Indonesian copy, with selective English fintech terms (Portfolio, Yield, Running)
- **Professional** — like a private bank, not a startup

### Anti-References (do NOT look like these)
- ❌ Crypto trading apps (Binance, Pintu, OKX) — too aggressive, too speculation-coded
- ❌ Web3 wallets (Phantom, MetaMask) — too purple/neon, AI-startup aesthetic
- ❌ Consumer SaaS (Linear, Notion) — too playful, too B2B
- ❌ Personal finance apps (Mint, Cash App) — too consumer/spending-focused
- ❌ Robinhood-style trading dashboards — too "trading energy", we're long-term holding

### Positive References
- ✅ **Ajaib** — Indonesian fintech UX, approachable investment, trust-coded
- ✅ **Stripe** — typography hierarchy, spacing, polish, calm premium
- ✅ **Atlassian** — restrained color, professional palette
- ✅ Private banking dashboards (BCA Prioritas, Mandiri Private)

## Strategic Principles

1. **Trust over flair** — every visual choice should make a 50-year-old businessman feel safe leaving Rp 100jt with us
2. **Clarity over density** — never cram. Information hierarchy beats data quantity.
3. **Speed over animation** — interactions feel instant. No bouncing, no spring physics.
4. **Indonesian primary** — but use English fintech terms where they read better (Portfolio, Yield)
5. **Mobile-first ergonomics** — thumb reach, 44pt targets, no horizontal scroll
6. **Public ≠ Admin** — public view shows polished portfolio reality; admin view shows operational truth (delays, skipped periods, real profit)
7. **No emoji as primary icons** — SVG only for affordances
8. **Restrained color** — neutrals + ONE accent. Status colors used sparingly for state, never decoration

## Constraints

- **Static GitHub Pages deployment** — no server, no build step, no SSR
- **Firestore as backend** — all state syncs to one document
- **Single user, multi-device** — no auth beyond PIN, no permissions model
- **Offline-tolerant** — localStorage fallback, syncs when online
- **Bandwidth-aware** — Indonesia mobile data is metered, keep page weight low

## Versioning

- **v2** = current production at `/index.html` — frozen, backwards-compatible only
- **v3** = premium revamp at `/v3/index.html` — new design system, modular vanilla architecture
- Both share same Firestore data
