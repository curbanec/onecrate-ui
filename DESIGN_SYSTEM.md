# OneCrate — Design Pattern Library

Authoritative reference for the OneCrate operator UI. Derived from the Fleet page
design in `Fleet Directions.dc.html`. Written for an implementing agent: every rule
here is a constraint, not a suggestion.

Target stack: Next.js, shadcn/ui, Tailwind v4, TanStack Table (Trades page).
Every value below is expressible as a theme token. Do not rebuild components from
scratch where a shadcn primitive exists — restyle it with these tokens.

---

## 1. Governing principles

1. **One question per screen.** Every screen answers: should this executor get more
   capital, less, or none. Anything that does not serve that question is cut.
2. **Numbers are most of the pixels.** The numeric face matters more than the display
   face. All figures are tabular.
3. **Evidence quality is visible.** A statistic derived from 6 trades must not look as
   authoritative as one from 200. Sample size sits adjacent to every derived figure.
4. **Density over air.** This is an instrument panel for one expert, not a landing page.
5. **Card frames are fixed; card contents vary.** The spine is identical on every row so
   the eye reads straight down a column.
6. **Fleet is read-only.** No destructive control on a scannable list.
7. **Empty and insufficient states are primary.** Decide what a figure shows at n=4
   before deciding what it shows at n=400.
8. **No invented content.** A value with no source renders as an em dash, never a
   plausible-looking number.

---

## 2. Color

Six roles plus state. Nothing outside this set. Gain and loss are the only saturated
colors on the page — everything else is a tinted neutral or the single purple accent.

### 2.1 Neutral ramp (dim surface, primary)

| Token | Hex | Job |
| --- | --- | --- |
| `desk` | `#E6E2EE` | Outside the app frame (canvas behind the panel) |
| `panel` | `#DCDDE7` | Main content surface |
| `rail` | `#D1D3E0` | Left nav rail, one step deeper than panel |
| `raised` | `#E5E6EE` | Small raised instrument blocks (freshness strip) |
| `frame` | `#C0C3D4` | Panel outer border |
| `hair` | `#C6C8D7` | Row separators, header rules, control borders |
| `rule` | `#A6A9BC` | Structural alignment marks (hairline cross) — deliberately stronger than `hair` |
| `muted` | `#565B6B` | Labels, column headers, secondary text |
| `ink` | `#1E2029` | Primary text and figures |

The neutrals are periwinkle/indigo-slate, not grey and not purple. This is deliberate:
it lets the interface carry a purple family feeling while the accent stays the only
element that reads as actually purple. Hue is consistent across the ramp.

An earlier light variant exists if a light mode is needed later:
`panel #F7F5FA`, `rail #EEEAF4`, `frame #DCD7E8`, `hair #DFDAEA`, `rule #CBC4DC`,
`muted #6B6579`, `ink #191622`.

### 2.2 Result direction

| Token | Hex | Job |
| --- | --- | --- |
| `gain` | `#0E8A5F` | Positive P&L and returns |
| `loss` | `#C33A4C` | Negative P&L and returns |
| `flat` | `#9A94A6` | Exactly zero, or no position that day |

`gain` is dark enough to read at 13px on the panel surface. `loss` is pulled toward
magenta so it sits in the neutral family rather than looking borrowed. The two differ
in lightness as well as hue, which is what keeps them separable under red-green color
deficiency — never rely on hue alone.

`flat` is its own token, not a fallthrough to `muted`. On an intraday strategy roughly
four days in five are flat, so this token controls a large share of what Fleet looks
like on any given morning.

### 2.3 Accent

| Token | Hex | Job |
| --- | --- | --- |
| `accent` | `#6B4FBB` | Links, interactive elements, primary action |
| `accent-surface` | `#CDCBE4` | Selected rows, active nav item, quiet accent fills |
| `accent-ink` | `#4A3689` | Text on `accent-surface` |
| `accent-line` | `#C9BCEB` | Underline color on accent links (light contexts) |

One accent. Purple carries it. The pastel version of the direction lives in `panel`
and `accent-surface`, not in the accent itself — a pastel cannot survive being both
text and a button border.

### 2.4 Lime — one job only

| Token | Hex | Job |
| --- | --- | --- |
| `highlight` | `#E2E7CD` | Row hover and expanded-card background tint |

Lime sits close enough to `gain` that any lime element near a figure weakens the
meaning of green. It gets exactly one job, far from any number. **If lime appears on
anything numeric, that is a bug.**

### 2.5 State

| Token | Hex | Job |
| --- | --- | --- |
| `state-open` | `#0E8A5F` | Holding a position (reuses `gain`) |
| `state-idle` | `#9A94A6` | Running but flat (reuses `flat`) |
| `state-halted` | `#C33A4C` | Stopped by kill switch or error (reuses `loss`) |
| `state-stale` | `#B4841F` | Data has not updated when it should have |

Amber appears nowhere else in the system. That is why it works as a warning.

### 2.6 Destructive

| Token | Hex | Job |
| --- | --- | --- |
| `destructive` | `#A32A2A` | Kill switch and other irreversible actions |

Deliberately a different, darker red than `loss`. A red number is information; a red
control is a warning. Never the same red. Destructive controls also get placement and
confirmation — color is never the only signal. **Not present on Fleet.**

### 2.7 Chart

| Token | Hex | Treatment |
| --- | --- | --- |
| `chart-capital-weighted` | `#1E2029` (`ink`) | Solid, 2px |
| `chart-equal-weighted` | `#7A63C4` | Dashed 5 4, 1.5px |
| `chart-reference` | `#9A94A6` (`flat`) | Zero line, dashed 3 3, 1px |
| `chart-grid` | `#C6C8D7` (`hair`) | Grid, where used |

The two series differ in weight and dash pattern as well as color, so the distinction
survives desaturation and printing. Neither borrows `gain` or `loss` — those are
reserved for result direction.

---

## 3. Type

Two faces. A third display face earns very little on a screen that is almost entirely
numbers and labels.

| Role | Family | Notes |
| --- | --- | --- |
| Numeric | JetBrains Mono | All figures. `font-variant-numeric: tabular-nums` always, even though mono is already fixed-width — it also aligns the fallback face. |
| Body | Inter | Labels, headings, prose. |

Alternative under consideration: Inter with tabular figures for numerics too, which
aligns correctly while reading less code-adjacent. If adopted, the change is one token.

### 3.1 Scale

| Token | Size / weight / line-height | Job |
| --- | --- | --- |
| `text-heading` | 28px / 500 / 1 · tracking −0.02em | Page title (`Fleet`), wordmark at 22px |
| `text-data-lg` | 20px / 500 / 1.2 | Headline figure (platform totals, aggregate returns) |
| `text-data` | 15px / 400 / 1.3 | Standard figure in rows and tables |
| `text-data-sm` | 13px / 400 / 1.3 | Dense or secondary figures |
| `text-label` | 11px / 500 / 1.2 · tracking .07em, uppercase | Column headers and field labels |
| `text-body` | 14px / 400 / 1.5 | Running prose, of which there is little |
| `text-note` | 13px / 400 / 1.3 | Row subtitles, inline annotations |

The largest figure on the page is 20px. Enormous headline numbers are a marketing
habit and read as overconfident on data this thin. The page title is the only thing
above that, and it is a title, not a figure.

Line-height on the page title is exactly 1 so its baseline can be aligned against
other elements without half-leading drift.

---

## 4. Space, radius, density

- Density: **compact**
- Rhythm: 4px base — 4 / 8 / 12 / 16 / 24 / 32
- Panel padding: 16px
- Row padding: 8px; minimum row height 36px
- Column gap in the header band: 30px; in figure groups: 26–28px
- `radius-card`: 6px — panel frame, outer containers
- `radius-control`: 4px — buttons, nav items, inline blocks, chart slots

Modest radii. Heavy rounding reads as consumer software; square reads as severe.

---

## 5. Layout patterns

### 5.1 Page shell

```
┌────────────┬──────────────────────────────────────────────┐
│ rail 188px │ content (flex:1, min-width:0, padding 16px)  │
│            │                                              │
│  logo      │  header band                                 │
│  cross     │  ───────────────────────────── hair rule     │
│  PROD/DEV  │  platform chart panel                        │
│  ────      │  ───────────────────────────── hair rule     │
│  nav       │  column header row                           │
│            │  executor rows                               │
└────────────┴──────────────────────────────────────────────┘
```

Panel: `background: panel`, `border: 1px solid frame`, `radius-card`, `overflow: hidden`.
Rail: `background: rail`, `border-right: 1px solid hair`.

### 5.2 The hairline cross (signature element)

A structural alignment mark in the rail header, in `rule` color. Two 1px spans crossing
at a configurable point:

- Vertical arm: full length downward from the top of the block (`crossArm`, default 126px)
- Horizontal arm: extends left from the intersection (`crossArmLeft`, default 108px)
- Both continue past the intersection by a short stub (`crossStub`, default 25px)
- Intersection sits at `crossX`% across the rail (default 71%)
- Block offset from the top of the rail: `crossTop` (default 7px)

The logo column — isometric cube above the wordmark, center-aligned as a stack — is
anchored to the vertical arm and sits just above the horizontal one. The cube is
centered on the wordmark by layout, never by a tuned pixel offset, and is clamped to
the space left of the vertical arm so it cannot overhang the panel edge.

**The Fleet header band's bottom rule sits at the same y as the cross's horizontal arm.**
This is the alignment the cross exists to express: `headerBandHeight = crossTop + crossArm`.
Implement it as a derived value, not a hardcoded height.

### 5.3 Header band

Height derived from the cross (§5.2). Bottom border `1px solid hair`, 4px bottom padding.

- Top-left: freshness strip (§6.4)
- Bottom-left: page title `Fleet` at `text-heading`, baseline aligned with the wordmark
- Bottom-right: platform totals — Executors, Allocated, Cumulative P&L, Closed trades.
  `text-label` over `text-data-lg`, 30px gaps, bottom-aligned.

### 5.4 Executor cards are a list, not a grid

Each card is a full-width row. The fixed spine occupies identical horizontal positions
on every card:

```
grid-template-columns: 300px 104px 104px 132px 104px 1fr 24px
                       ident  alloc deploy P&L   trades signal caret
```

- Identifier, left: `accent` colored, underlined, `text-data` in the numeric face.
  **This is the only navigation target on the card.**
- Row subtitle beneath it: `text-note` in `muted` — strategy character, e.g.
  "intraday · does not trade every day".
- Allocated / Deployed / P&L / Trades: right-aligned, tabular.
- Signal slot: the one region that varies by strategy character (§6.2).
- Caret: `+` collapsed, `−` expanded.

Row hover: `background: highlight`. Row separator: `1px solid hair`.

### 5.5 Expansion vs navigation

Expanding is reversible; navigating is not. Therefore the large target belongs to
expansion.

- **Card body toggles open on click.** The whole card is never a link.
- **Navigation to detail lives on two precise targets:** the identifier link, and an
  explicit "Open detail →" button in the expanded state. Both must
  `stopPropagation()` so they don't also toggle.
- Multiple cards can be expanded at once. State is a keyed map, not a single index.

Expanded content sits on `highlight`, in a `1fr 1fr 188px` grid:
recent trades · parameter set · win rate + Open detail button.

---

## 6. Data-honesty patterns

These are the patterns that make this interface different from a generic dashboard.
Implement them exactly.

### 6.1 Evidence quality

One constant, recorded once, never scattered through component logic:

```
EVIDENCE_THRESHOLD = 30  // closed trades
```

- Figures at or above threshold render in `ink` (`evidence-strong`).
- Figures below threshold render in `flat` (`evidence-weak`) — they recede.
- Sample size appears adjacent to every derived statistic: `n=31`, or `n=12 · weak`.
- **Derived statistics below threshold are withheld, not shown.** Win rate at n=12
  renders as `—` with the note "not derived below n=30". Showing a number with a
  caveat is worse than not showing it.

### 6.2 The signal slot

The one region that varies by strategy character. Currently a labeled placeholder
awaiting real series data; the intended treatments:

| Strategy character | Signal treatment |
| --- | --- |
| Intraday, mostly-flat days | Discrete daily marks — NOT a sparkline. ~80% of days are zero; a smooth line lies about that. |
| Multi-day holds, continuous | A real equity line |
| Pairs | Current spread state |

### 6.3 Live vs carried marks

Not all daily marks are equally trustworthy. Some come from live broker data, some are
carried forward from a previous close.

- **Live**: no treatment. This is the default.
- **Carried**: a hollow dot in `flat`, placed immediately before the figure.

In the chart, carried points render as hollow circles; live points are filled.
Noticeable on inspection, invisible when scanning. A color would be too loud.

### 6.4 Freshness strip

A small raised block at the top of the header band: `background: raised`,
`1px solid hair`, `radius-control`, padding 10px 14px, 26px gaps.

- **AS OF** — timestamp, preceded by a `state-stale` dot when the data is older than
  expected. Renders `—` when no timestamp is available.
- **CARRIED MARKS** — count plus which executors, e.g. "1 · gap-fade v3 · SNOW".

Only facts the data actually supports appear here. Do not add a reconciliation
readout — see §6.5.

### 6.5 Reconciliation drift is a banner, not a panel

Invisible when drift is zero, impossible to ignore when it is not. Full-width bar at
the top of the content area: `background: loss`, white text, `text-label` sizing,
`radius-control`. No always-on "no drift" readout anywhere.

### 6.6 Sparse data is the steady state

Equity curves have 4–40 points, not two years of daily bars. Gaps on every weekend and
market holiday.

- **Never interpolate across a gap.** X positions are advanced across gaps so weekends
  read as absence; the polyline does not smooth over them.
- Plot discrete point markers, not just a line — with 24 points the individual marks
  are the information.
- Any layout that only looks correct with dense, smooth data is the wrong layout.

### 6.7 Missing values

A value with no source renders as an em dash (`—`) in `flat`, never as a zero, a
placeholder number, or an estimate. Structural placeholders (awaiting a real endpoint)
render as a hatched region with a label saying what belongs there.

---

## 7. Copy rules

- The label is `gap-fade v3 · HOOD`. Not "Strategy Performance Overview."
- Middle dot (`·`) separates identifier parts and inline annotations.
- Column headers and field labels: uppercase, `text-label`, letterspaced.
- Metric explanations are one lowercase clause: "what the book actually earned",
  "how the average strategy behaved". No sentence case, no periods, no product voice.
- Sample-size notes: `n=12 · weak`, `not derived below n=30`, `over 31 closed`.
- Use the minus sign `−` (U+2212) in negative figures, not a hyphen — it matches the
  plus sign's width in tabular figures.

---

## 8. Explicit anti-patterns

Do not:

- Build a row of four evenly spaced KPI cards with big numbers and green percentage
  deltas over a smooth gradient area chart. Subject-agnostic, which is the problem.
- Use dark mode with a single bright accent. Obvious for a trading tool and a current
  design default. The dim surface here is earned through neutral tinting, not inversion.
- Put a destructive control on a card in a list.
- Make the whole card a link.
- Use lime on or near a figure.
- Show a derived statistic below the evidence threshold.
- Interpolate a sparse series to look dense.
- Add a metric, column, or content block that no data source supports.
- Set a figure in a proportional face without tabular figures.
- Exceed 20px for any figure.

---

## 9. Tailwind v4 theme block

```css
@theme {
  --color-desk: #E6E2EE;
  --color-panel: #DCDDE7;
  --color-rail: #D1D3E0;
  --color-raised: #E5E6EE;
  --color-frame: #C0C3D4;
  --color-hair: #C6C8D7;
  --color-rule: #A6A9BC;
  --color-muted: #565B6B;
  --color-ink: #1E2029;

  --color-gain: #0E8A5F;
  --color-loss: #C33A4C;
  --color-flat: #9A94A6;

  --color-accent: #6B4FBB;
  --color-accent-surface: #CDCBE4;
  --color-accent-ink: #4A3689;
  --color-accent-line: #C9BCEB;

  --color-highlight: #E2E7CD;
  --color-state-stale: #B4841F;
  --color-destructive: #A32A2A;

  --color-chart-cw: #1E2029;
  --color-chart-ew: #7A63C4;
  --color-chart-ref: #9A94A6;

  --font-numeric: 'JetBrains Mono', ui-monospace, monospace;
  --font-body: Inter, system-ui, sans-serif;

  --radius-card: 6px;
  --radius-control: 4px;
}
```

Constants that are not colors but must live in one place:

```ts
export const EVIDENCE_THRESHOLD = 30;   // closed trades
export const RAIL_WIDTH = 188;          // px
export const ROW_MIN_HEIGHT = 36;       // px
```
