# DanaTrack v3 — DESIGN.md

> Committed visual choices for v3. Read by impeccable skill. All decisions are intentional, not vibing.

## Color Strategy

**Restrained** — tinted neutrals + one accent ≤10% of surface area.

Per impeccable rules: "The 'one accent ≤10%' rule is Restrained only. Don't collapse every design to Restrained by reflex." For a fintech tracker, restrained IS correct — accent communicates state, not decoration.

## Color Tokens

### Surfaces (cool-tinted neutrals)
| Token | Value | Use |
|---|---|---|
| `--c-bg` | `#FAFBFD` | Page background |
| `--c-surface` | `#FFFFFF` | Card, modal, raised |
| `--c-surface-muted` | `#F6F8FB` | Subtle section, inputs |
| `--c-border` | `#E6E8ED` | Default border |
| `--c-border-strong` | `#D7DAE0` | Emphasis border |

### Text (Stripe-style deep navy)
| Token | Value | Use |
|---|---|---|
| `--c-text` | `#1A1F36` | Primary text, headings |
| `--c-text-muted` | `#5A6478` | Secondary text |
| `--c-text-subtle` | `#8792A2` | Tertiary, labels |
| `--c-text-inverted` | `#FFFFFF` | On dark bg |

### Brand (Stripe indigo)
| Token | Value | Use |
|---|---|---|
| `--c-primary` | `#635BFF` | Primary action, brand |
| `--c-primary-hover` | `#5046E5` | Hover state |
| `--c-primary-active` | `#4239C9` | Active/pressed |
| `--c-primary-bg` | `#F0EFFC` | Tinted backgrounds |

### Status (desaturated, professional)
| Status | Color | BG | Vocabulary (ID) |
|---|---|---|---|
| Success | `#00875A` | `#E6F4EE` | Lunas, Berjalan |
| Warning | `#B45309` | `#FEF6EA` | Pendanaan |
| Error | `#B42318` | `#FCE8EC` | Tertunda (admin only) |
| Info | `#0570DE` | `#E5F0FB` | — |
| Neutral | `#687385` | `#F1F3F6` | Tidak Terambil (admin only) |

**Anti-patterns explicitly avoided:**
- ❌ NO purple/pink AI gradient
- ❌ NO pure `#000` or `#FFF` (always tinted)
- ❌ NO oversaturated accent colors (>80% saturation)
- ❌ NO mixing warm and cool grays

## Typography

### Fonts
- **Sans (UI)**: `Inter` — strong fintech association, excellent at small sizes
- **Mono (Numbers)**: `JetBrains Mono` — for ALL currency, percentages, dates

```css
font-family: "Inter", system-ui, -apple-system, sans-serif;
font-family: "JetBrains Mono", "Geist Mono", ui-monospace, monospace;
```

### Type Scale
| Token | Size | Weight | Use |
|---|---|---|---|
| `--fs-hero` | 40px | 700 | Hero balance number |
| `--fs-3xl` | 32px | 700 | Page hero title |
| `--fs-2xl` | 24px | 700 | Section header |
| `--fs-xl` | 20px | 600 | Card title |
| `--fs-lg` | 17px | 600 | Body emphasis |
| `--fs-md` | 15px | 500 | Body default |
| `--fs-base` | 14px | 400 | Default |
| `--fs-sm` | 12px | 500 | Caption, badge |
| `--fs-xs` | 11px | 600 | Label (uppercase) |

### Letter-spacing
- Hero / 3xl: `-0.04em` (tight)
- 2xl / xl: `-0.02em`
- Body: `0`
- Labels (uppercase): `+0.04em`

### Number tabular
All numeric displays use `font-variant-numeric: tabular-nums lining-nums` AND JetBrains Mono. This prevents jitter when numbers update.

## Spacing System (4px base)

| Token | Value | Use |
|---|---|---|
| `--s-1` | 4px | Tight inline gaps |
| `--s-2` | 8px | Component internal |
| `--s-3` | 12px | Default gap |
| `--s-4` | 16px | Section gap |
| `--s-5` | 20px | Card padding |
| `--s-6` | 24px | Page padding |
| `--s-8` | 32px | Section divider |
| `--s-10` | 40px | Hero spacing |
| `--s-12` | 48px | Major section |

**Spacing rules:**
- Cards: `--s-5` (20px) padding internal
- Page edge: `--s-4` (16px) horizontal
- Between cards: `--s-3` (12px) vertical
- Between sections: `--s-6` (24px)

## Radii

Varied not uniform. Outer (containers) larger, inner (buttons, badges) smaller.

| Token | Value | Use |
|---|---|---|
| `--r-xs` | 4px | Inline tags |
| `--r-sm` | 6px | Badges |
| `--r-md` | 8px | Buttons, inputs |
| `--r-lg` | 12px | Small cards |
| `--r-xl` | 16px | Default cards |
| `--r-2xl` | 24px | Hero, modal |
| `--r-full` | 9999px | Pills |

## Elevation

Single 5-step token system. NEVER inline shadows.

| Token | Use |
|---|---|
| `--sh-0` | Flat, ground level |
| `--sh-1` | Subtle separation |
| `--sh-2` | Default cards |
| `--sh-3` | Hover, raised state |
| `--sh-4` | Floating (FAB, sheet) |
| `--sh-5` | Modal overlay |

All shadows use cool tint `rgba(26,31,54, alpha)` — matches navy text, no pure black.

## Motion

**Per Emil Kowalski rules** (design-motion-principles skill): functional > decorative. Fast not bouncy.

| Duration | Use |
|---|---|
| `--dur-1` 120ms | Tap feedback |
| `--dur-2` 200ms | Hover, focus, transitions |
| `--dur-3` 320ms | Modal sheets, page transitions |

**Easing:**
- `--ease-out` `cubic-bezier(.16,1,.3,1)` — default, settles smoothly
- `--ease-spring` `cubic-bezier(.34,1.56,.64,1)` — RESERVED for delight moments only (rare)

**Banned:**
- ❌ Bouncing on every tap
- ❌ Glow effects on hover
- ❌ Scale animations >1.05
- ❌ Animation duration >400ms (except modal sheets)
- ❌ Auto-playing animations on load

## Components — Visual Spec

### ProjectCard (the most-used component)
- Height: ~110-120px (was ~190px in v2 — 40% reduction)
- Padding: `--s-5` (20px)
- Layout: icon + title row → progress + meta row
- Badge: top-right
- Slim 4px progress bar with label outside
- No drop shadow at rest, `--sh-2` on hover (mouse)
- Tap: `scale(0.98)` 120ms

### Hero
- Indigo gradient: `linear-gradient(135deg, #635BFF 0%, #4239C9 100%)`
- 24px radius
- 24px padding
- Big mono number (40px)
- Subtle radial highlight top-right
- NO sparkle stars, NO neon glow

### BottomNav
- Glass: `rgba(255,255,255,.78)` + `backdrop-filter: blur(24px)`
- 4 items: Beranda, Operasi, Dokumen, Admin
- Active: indigo pill background, white icon+label
- 72px height + safe-area padding
- 16px from screen edges

### Status Badge
- 6px radius (small, not pill)
- 11px text, uppercase, 600 weight
- Colored bg + matching text (success/warning/error/info/neutral)
- NO border (cleaner than v2)

### Progress
- Height: 4px (was 10px in v2 — slimmer)
- Background: `--c-surface-muted`
- Fill: solid `--c-primary` (no gradient by default)
- Label OUTSIDE the bar, never inside

## Animation Patterns

### Card render stagger
```css
.pc { animation: cardIn 320ms var(--ease-out) both; }
.pc:nth-child(2) { animation-delay: 30ms }
.pc:nth-child(3) { animation-delay: 60ms }
/* max 90ms delay — don't make user wait */
```

### Modal sheet
```css
.modal { transform: translateY(100%); transition: transform 320ms var(--ease-out); }
.mo.open .modal { transform: translateY(0); }
```

## Accessibility

- 44x44pt minimum touch targets (per impeccable rules)
- Focus rings: 3px `rgba(99,91,255,.18)` outset
- Color contrast: 4.5:1 minimum for text, 3:1 for large text + UI
- Respect `prefers-reduced-motion`: cut all transitions to 1ms
- Respect `prefers-color-scheme: dark` (future, not v3 launch)

## Anti-Patterns Explicitly Avoided

Per `redesign-existing-projects` + `taste-skill`:

1. ❌ Three equal columns (use asymmetric layouts)
2. ❌ Generic "border + shadow + white" cards (use surface + border, shadow only on elevation)
3. ❌ Single-button hierarchy (primary + ghost + text link)
4. ❌ Pill badges for "New/Beta" (use squared corners)
5. ❌ Modals for everything (inline edit, slide-overs preferred)
6. ❌ Avatar circles only (consider rounded squares)
7. ❌ Browser default fonts or Inter-everywhere (Inter sans + Mono numbers is intentional)
8. ❌ All-caps subheaders everywhere (selective use, only labels)
9. ❌ Title Case On Every Header (sentence case)
10. ❌ Lorem Ipsum, generic names, fake data (real or empty)
