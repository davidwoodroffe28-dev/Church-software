# Church Presenter

Church media presentation software (EasyWorship-style): song lyrics, media backgrounds, Bible verses,
PowerPoint slides, and lower-thirds — driven from a control window, displayed on one or more output
windows (Program/Audience, Stage Display, Stream/Lower-Thirds).

## Stack

Electron + React + TypeScript, built with Vite. Local data (songs, media, playlists, templates,
presentations, output configuration) is persisted with `electron-store` under the OS's app-data
directory — no server, no account, fully offline.

## Getting started

```bash
npm install
npm run dev      # starts Vite + Electron with hot reload
```

```bash
npm run build    # builds the renderer (Vite) and main process (tsc) into dist/ and dist-electron/
npm start        # runs the built app
```

`npm run typecheck` runs `tsc --noEmit` for both the renderer and the Electron main process.

## Layout

Three panels, matching the standard broadcast Preview/Program split:

- **Left — Schedule**: the order of service, drag-and-drop reorderable. An **+ Add Items** tab
  switches the same panel to the Library (Songs/Media/Bible/Slides) to bring items into the schedule.
- **Center — Slide Preview & Grid**: an enlarged preview of the selected slide plus a thumbnail grid of
  every sub-slide in the selected item (song sections, presentation pages) for quick jumping.
- **Right — Live Output**: the actual on-air monitor, **GO LIVE**, and independent **Clear Text** /
  **Clear Background** / **Clear All** controls — e.g. clear the lyric text while a video background
  keeps looping, or vice versa — plus stage message/clock controls and output status.

## Features

- **Song lyrics** — sectioned editor (verse/chorus/bridge/…), click-through presentation.
- **Media backgrounds** — image or looping video behind lyrics/scripture, or as a full-screen media
  playlist item.
- **Bible** — full offline search across 9 public-domain/free English translations (KJV, KJV-PCE, ASV,
  WEB, Geneva, Bishops', Coverdale, Tyndale, NET), by reference (`John 3:16`, `Psalms 23`, `1 John 2:1-3`)
  or keyword. See **Bible data license** below.
- **PowerPoint import** — two-tier, no required install:
  1. If a local LibreOffice is found, converts `.pptx`/`.ppt` to PDF (`soffice --headless
     --convert-to pdf`) and renders pages with `pdf.js` — pixel-accurate.
  2. Otherwise, falls back automatically to a built-in, dependency-free reader that unzips the
     `.pptx` (it's just a zip of XML) and reconstructs each slide's text, position, font size/color,
     and background image directly from the OOXML. This is **approximate** — it doesn't resolve
     slide-layout/master inheritance or effects/animations, so text size and position may not match
     the original exactly, and only very simple shapes/pictures are read (no grouped shapes, tables,
     or charts). The library flags which mode was used (a warning on import, an "approx." badge in
     the Slides tab) so you always know when to expect a mismatch. Install LibreOffice (free,
     https://www.libreoffice.org/) for exact fidelity.
- **Song import** — bulk-import an existing song library:
  - OpenLyrics XML (the standard interchange format used by OpenLP, VideoPsalm, etc.)
  - OpenSong-style / ChordPro / plain CCLI-pasted text (chords and section tags like `[Verse 1]`
    are detected and stripped/parsed automatically)
  - CSV with `title,author,lyrics` columns
  - **EasyWorship** — best-effort reader for an EasyWorship 7 (SQLite-based) song database. EasyWorship's
    database schema isn't officially documented, so this scans the database for a plausible songs table
    and a related lyrics/slides table rather than assuming exact column names — it works when the file is
    genuinely SQLite, but titles-only is possible if no lyrics table is found. **EasyWorship 6 and
    earlier** store songs in a SQL Server Compact `.sdf` file (a proprietary binary format) which this
    cannot read at all; export to CCLI text or use OpenLP's EasyWorship importer to convert to OpenLyrics
    XML first in that case.
- **Multiple simultaneous outputs**, each independently assigned to a physical display (or left
  windowed, e.g. for capture):
  - **Program** — the full audience/projector feed (background + text, or full-frame media/slides).
  - **Stage Display** — a confidence monitor for performers/speakers: current text (no background
    video), an "up next" preview, an optional operator message, and a clock.
  - **Stream** — a dedicated lower-thirds overlay window (chroma-key or your own color) for OBS/vMix
    Window Capture during a livestream. Full-frame content (media loops, PowerPoint slides) is expected
    to be cut to directly from the Program output in your video switcher; this window only ever shows
    text (lyrics/scripture/announcements) as a lower-third bar over the key color.

For a hardware switcher (ATEM, etc.) instead of OBS/vMix: assign the Stream output to the physical
display connected to the switcher's HDMI input, set its chroma key, and key it out on the switcher —
no in-app streaming/encoding involved, this app only ever produces the graphics layer.

Configure outputs from **Outputs…** in the control window (display assignment, chroma key color,
enable/disable per role).

## Bible data license

The bundled translations in `resources/bible/` come from a Bible SuperSearch export. Per
`resources/bible/SOURCE-README.txt`, they are "legally shareable and reshareable for non-commercial
purposes" — check the license terms for the specific translation(s) you ship with (the NET Bible in
particular has its own attribution/usage terms) before distributing this app commercially.

## Known limitations / possible follow-ups

- The no-LibreOffice PowerPoint fallback doesn't resolve slide-layout/master inheritance, grouped
  shapes, tables, charts, or effects/animations — install LibreOffice for exact fidelity.
- The EasyWorship importer is schema-sniffing/best-effort, not a verified 1:1 port.
- No packaging/installer setup yet (`electron-builder` etc.) — currently run via `npm start` or `npm run dev`.
- No live preview of an external video switcher's (e.g. ATEM) program feed inside the app yet — only
  the graphics/lower-thirds output is produced; camera mixing stays on the switcher.
