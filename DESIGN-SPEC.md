# Sanctuary — Design Instructions

Church presentation software. Windows desktop. Dark and light. Built for volunteers
who were handed the laptop ten minutes before the service starts.

---

## 1. Principles

1. **Nothing live happens by accident.** Preview is where you stage; Live is where the
   congregation sees it. Only one control ever crosses that line, and it is labelled
   "Send to Live →".
2. **Everything visible on one page.** Eight labelled tab buttons in a single top row —
   no icon rail, no nested menus, no hidden drawers. A volunteer should never hunt.
3. **Easy on the eyes for 90 minutes.** No pure black, no pure white, no saturated
   fills at panel scale. Colour is reserved for state, not decoration.
4. **Roomy over dense.** Bigger targets and more breathing room beat fitting one more
   row on screen. This is not a pro video tool.
5. **The slide monitor is the source of truth.** Every screen that can change output
   shows a real 16:9 monitor of what the room sees.

---

## 2. Colour

Both themes are built from one token set. Never hard-code a colour outside it.

| Token | Dark | Light | Use |
|---|---|---|---|
| `--bg` | `#16181c` | `#eef0f2` | App canvas, centre column |
| `--panel` | `#1c1f24` | `#fbfbfc` | Side panels, cards, title bar |
| `--panel2` | `#23272d` | `#f2f4f6` | Raised rows, secondary buttons, selected state |
| `--line` | `#30353d` | `#dfe3e8` | All 1px dividers and borders |
| `--ink` | `#e9ebee` | `#22262b` | Primary text |
| `--ink2` | `#aab3bd` | `#575f6a` | Secondary text, button labels |
| `--ink3` | `#8b939d` | `#6e7783` | Metadata, mono labels (min 4.5:1) |
| `--hover` | `#282d34` | `#e9ecef` | Hover fill on any clickable row |
| `--input` | `#13161a` | `#ffffff` | Text field interiors |
| `--accent` | `#3fb6bf` | `#3fb6bf` | Selection, focus, primary action |
| `--live` | `#c9564f` | `#b8453d` | On-air state only |
| `--screen` | `#0c0e11` | `#15181c` | Inside a slide monitor — always dark, both themes |

**Rules**

- `--live` is never used for anything that is not currently on the main output.
  Not for delete, not for errors, not for emphasis.
- `--accent` marks *your* selection — the verse you are staging, the active tab,
  the chosen font. It never means "live".
- Item-type stripes in the service list are fixed and are the only other hues:
  Song `#3fb6bf`, Scripture `#c9a55e`, Media `#8f7ed6`, Slides `#79b56a`.
- Max two background values per screen (`--bg` and `--panel`). No gradients.
- Slide monitors stay dark in light mode — the room is dark, so the preview must match.

---

## 3. Type

- **UI:** IBM Plex Sans — 400 / 500 / 600 only.
- **Metadata, counts, timecode, labels:** IBM Plex Mono, uppercase,
  `letter-spacing: .08–.12em`. This is the only place caps are used.
- **Editorial and scripture:** Source Serif 4 — song titles in the editor,
  verse text, the greeting on Home.

| Role | Size | Weight |
|---|---|---|
| Screen title | 19px | 600 |
| Panel header (mono, caps) | 10.5px | 500 |
| Item title | 13.5–14px | 500 |
| Body / lyric row | 13.5px / 1.5 | 400 |
| Monitor lyric | 16px / 1.4 | 400 |
| Metadata (mono) | 9.5–11px | 400 |
| Stage display lyric | 40px | 500 |

Never below 9.5px, and only ever mono at that size. Body text never below 12.5px.

---

## 4. Space, shape, depth

- **Grid:** 4px base. Padding steps 8 / 10 / 12 / 14 / 16 / 18 / 22 / 26.
- **Radii:** 6px chips and swatches · 7–8px buttons and rows · 10px monitors ·
  13–14px cards and containers · 20px filter pills.
- **Depth:** one shadow token only —
  `0 1px 2px rgba(0,0,0,.28), 0 10px 30px rgba(0,0,0,.30)` (dark) /
  `0 1px 2px rgba(28,32,38,.05), 0 8px 24px rgba(28,32,38,.07)` (light).
  Cards and monitors get it. Panels and rows do not.
- **Layout:** always flex/grid with `gap`. Never margin-spaced siblings.
- **Hit targets:** minimum 44px tall for anything touched during a service —
  transport arrows, Black/Clear/Logo, Send to Live, tab buttons.

---

## 5. Structure

```
Title bar      app · service name · saved · theme toggle · ON AIR chip · window controls
Tab row        Home  Live  Songs  Bible  Media  Themes  Stage  Settings
Screen         (varies — see below)
Status bar     live item · state · output resolution · keyboard hints
```

The tab row is the only navigation. The active tab is `--panel2` fill with a
`--accent` border; the rest are transparent with `--ink2` labels.

### Live (the operator screen)

Three columns: **Library** (306px) · **Preview | Live** (fluid, split evenly) ·
**Service** (338px).

Each of Preview and Live is the same vertical stack, which is what makes the pairing
readable:

```
header       pane name · slide count / live label · item title
slide list   scrollable, verse-labelled rows (min-height 170px)
transport    ◀ ▶ · then the pane's own actions
monitor      16:9 output with song credits in the corner
```

- Preview's action is **Send to Live →** (accent fill).
- Live's actions are **Black / Clear / Logo** (toggle buttons, fill when active).
- The on-air row in the Live list is filled `--live` with white text, and auto-scrolls
  into view as slides advance.
- Screen floors: `min-width: 1420px`, `min-height: 780px`. Below that the screen area
  scrolls — panels never compress.

### Other screens

- **Home** — greeting, one large Continue card, four action cards, recent schedules table.
- **Songs** — sections list · title + lyric textarea + live slide split · details and arrangement.
- **Bible** — translation and book · chapter grid · verse list with Add / Go live.
- **Media** — filter pills, 16:9 thumbnail grid, selected-item panel with playback toggles.
- **Themes** — theme list · large 16:9 preview · font, size, alignment, effects.
- **Stage** — single large stage-display mock: clock, timer, current lyric, NEXT.
- **Settings** — category list · labelled toggle rows with one line of plain-English help.

---

## 6. State and interaction

| State | Treatment |
|---|---|
| Hover (any clickable row) | fill `--hover`, no movement |
| Selected / staged | fill `--panel2`, 1px `--accent` border, accent mono label |
| Live | fill `--live`, white text, `LIVE` mono badge |
| Toggle on | track `--accent`, knob flush right |
| Card hover | `--accent` border, `translateY(-1px)`, 140ms ease |

Transitions are 140ms and only on colour, border, and 1px lifts. Nothing slides,
fades, or bounces — the operator's eye must stay on the lyric.

**Keyboard:** `← →` advance live · `B` black · `Esc` clear. Suppressed while typing.
Every keyboard action has a visible button; the shortcuts are shown in the status bar.

---

## 7. Copy

- Buttons are verb-first and literal: "Send to Live", "Add to schedule", "Save & close".
- Settings rows get one sentence of plain help, no jargon: "Log every song shown for
  your annual usage report."
- Mono metadata is terse and uppercase: `SONG · 6 SLIDES`, `OUTPUT 1920×1080`.
- Never "utilize", never an exclamation mark, never an emoji.

---

## 8. Accessibility floor

- Text 4.5:1 against its own background — `--ink3` is the lightest permitted grey and
  is already at the line. Do not go lighter.
- State is never colour alone: live rows also carry a `LIVE` badge, active tabs also
  carry a border, toggles also move.
- Focus is visible on every control; the accent ring is never removed.
