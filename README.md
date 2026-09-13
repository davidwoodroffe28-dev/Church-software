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

## Features

- **Song lyrics** — sectioned editor (verse/chorus/bridge/…), click-through presentation.
- **Media backgrounds** — image or looping video behind lyrics/scripture, or as a full-screen media
  playlist item.
- **Bible** — full offline search across 9 public-domain/free English translations (KJV, KJV-PCE, ASV,
  WEB, Geneva, Bishops', Coverdale, Tyndale, NET), by reference (`John 3:16`, `Psalms 23`, `1 John 2:1-3`)
  or keyword. See **Bible data license** below.
- **PowerPoint import** — converts `.pptx`/`.ppt` to PDF via a locally installed LibreOffice
  (`soffice --headless --convert-to pdf`), then renders pages with `pdf.js`. **Requires LibreOffice**
  (free, https://www.libreoffice.org/) to be installed on the machine — there is no practical
  cross-platform way to rasterize PowerPoint files otherwise.
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

Configure outputs from **Outputs…** in the control window (display assignment, chroma key color,
enable/disable per role).

## Bible data license

The bundled translations in `resources/bible/` come from a Bible SuperSearch export. Per
`resources/bible/SOURCE-README.txt`, they are "legally shareable and reshareable for non-commercial
purposes" — check the license terms for the specific translation(s) you ship with (the NET Bible in
particular has its own attribution/usage terms) before distributing this app commercially.

## Known limitations / possible follow-ups

- PowerPoint import requires LibreOffice; there's no bundled fallback renderer.
- The EasyWorship importer is schema-sniffing/best-effort, not a verified 1:1 port.
- No drag-and-drop reordering yet (up/down buttons only).
- No packaging/installer setup yet (`electron-builder` etc.) — currently run via `npm start` or `npm run dev`.
