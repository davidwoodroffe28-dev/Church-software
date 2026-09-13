import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import type { Song, SongSection } from '@shared/types';

const HEADER_WORDS: Record<string, string> = {
  v: 'Verse',
  verse: 'Verse',
  c: 'Chorus',
  chorus: 'Chorus',
  b: 'Bridge',
  bridge: 'Bridge',
  pc: 'Pre-Chorus',
  prechorus: 'Pre-Chorus',
  'pre-chorus': 'Pre-Chorus',
  intro: 'Intro',
  outro: 'Outro',
  ending: 'Ending',
  tag: 'Tag',
  interlude: 'Interlude',
  refrain: 'Refrain',
};

const HEADER_LINE_RE = /^[\[(]?\s*([a-zA-Z-]+)\.?\s*(\d+)?\s*[\])]?:?$/;

function makeSection(label: string, text: string): SongSection {
  return { id: crypto.randomUUID(), label, text: text.trim() };
}

function newSongShell(title: string): Omit<Song, 'sections' | 'sequence'> {
  return {
    id: crypto.randomUUID(),
    title,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function finalizeSong(shell: Omit<Song, 'sections' | 'sequence'>, sections: SongSection[]): Song {
  const nonEmpty = sections.filter((s) => s.text.trim().length > 0);
  const finalSections = nonEmpty.length ? nonEmpty : [makeSection('Verse 1', '')];
  return { ...shell, sections: finalSections, sequence: finalSections.map((s) => s.id) };
}

function parseHeaderLabel(line: string): string | null {
  const match = line.trim().match(HEADER_LINE_RE);
  if (!match) return null;
  const word = match[1].toLowerCase();
  const canonical = HEADER_WORDS[word];
  if (!canonical) return null;
  return match[2] ? `${canonical} ${match[2]}` : canonical;
}

const METADATA_LINE_RE = /^(ccli|©|copyright|used by permission|all rights reserved|for use solely|www\.|http)/i;

/** Groups already-cleaned lyric lines into sections, splitting on [Verse]/[Chorus]-style header
 *  lines when present, or on blank-line-separated blocks (labelled Verse 1, 2, 3…) otherwise.
 *  Shared by the plain-text and OpenSong XML parsers, which differ only in how they get from their
 *  raw source to this same flat line array. */
function splitIntoSections(lines: string[]): SongSection[] {
  const hasAnyHeader = lines.some((l) => parseHeaderLabel(l) !== null);

  const sections: SongSection[] = [];
  if (hasAnyHeader) {
    let currentLabel = 'Verse 1';
    let buffer: string[] = [];
    const flush = () => {
      if (buffer.length) sections.push(makeSection(currentLabel, buffer.join('\n')));
      buffer = [];
    };
    for (const line of lines) {
      const header = parseHeaderLabel(line);
      if (header) {
        flush();
        currentLabel = header;
      } else {
        buffer.push(line);
      }
    }
    flush();
  } else {
    const blocks = lines
      .join('\n')
      .split(/\n\s*\n+/)
      .map((b) => b.trim())
      .filter(Boolean);
    blocks.forEach((block, idx) => sections.push(makeSection(`Verse ${idx + 1}`, block)));
  }
  return sections;
}

/** Parses ChordPro-style or plain/CCLI-pasted lyric text (no XML wrapper) into a Song. */
export function parsePlainTextSong(content: string, title: string): Song {
  const shell = newSongShell(title);
  const rawLines = content.replace(/\r\n/g, '\n').split('\n');

  const lines = rawLines
    .filter((l) => !METADATA_LINE_RE.test(l.trim()))
    .map((l) => l.replace(/\[[^\]]{1,20}\]/g, (token) => (parseHeaderLabel(token) ? token : ''))); // strip inline chords, keep header tokens

  return finalizeSong(shell, splitIntoSections(lines));
}

/** Parses a genuine OpenSong per-song XML file (the format OpenSong/OpenLP libraries actually
 *  export — one file per song, XML-wrapped: <song><title/><author/><lyrics>[V1]\n.chord line\n
 *  lyric line</lyrics></song>). Distinct from OpenLyrics XML (which wraps everything in a
 *  <properties>/<lyrics><verse> structure) — both start with a <song> root, so callers should try
 *  parseOpenLyricsXml first and fall back to this. Returns null if it doesn't look like OpenSong. */
export function parseOpenSongXml(xml: string, fallbackTitle: string): Song | null {
  try {
    const parser = new XMLParser({ ignoreAttributes: true, textNodeName: '#text' });
    const doc = parser.parse(xml);
    const song = doc?.song;
    if (!song || song.lyrics == null) return null; // no <lyrics> at the top level: not OpenSong's shape

    const title = (typeof song.title === 'string' ? song.title : song.title?.['#text']) || fallbackTitle;
    const shell = newSongShell(String(title).trim() || fallbackTitle);
    const author = typeof song.author === 'string' ? song.author : song.author?.['#text'];
    if (author) (shell as Song).author = String(author).trim();

    const lyricsRaw: string = typeof song.lyrics === 'string' ? song.lyrics : String(song.lyrics?.['#text'] ?? '');
    // OpenSong prefixes each chord/tab line with '.' (chords sit above the lyric line they apply
    // to) — drop those before section-splitting so chord tokens never leak into the lyric text.
    const lines = lyricsRaw
      .replace(/\r\n/g, '\n')
      .split('\n')
      .filter((l) => !/^\s*\./.test(l));

    return finalizeSong(shell, splitIntoSections(lines));
  } catch {
    return null;
  }
}

/** Parses an OpenLyrics XML song file (https://docs.openlyrics.org/). Returns null if it doesn't look like OpenLyrics. */
export function parseOpenLyricsXml(xml: string, fallbackTitle: string): Song | null {
  try {
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', textNodeName: '#text' });
    const doc = parser.parse(xml);
    const song = doc?.song;
    // OpenLyrics always wraps metadata in <properties> (https://docs.openlyrics.org/); genuine
    // OpenSong XML has no such wrapper (flat <title>/<author>/<lyrics>) — without this check, any
    // OpenSong file would silently "succeed" here with an empty song (song.lyrics is a plain
    // string there, so song.lyrics?.verse below is always undefined) instead of falling through
    // to parseOpenSongXml.
    if (!song || !song.properties) return null;

    const titlesNode = song.properties?.titles?.title;
    const titleEntry = Array.isArray(titlesNode) ? titlesNode[0] : titlesNode;
    const title =
      (typeof titleEntry === 'string' ? titleEntry : titleEntry?.['#text']) || fallbackTitle;

    const shell = newSongShell(title);
    const author = song.properties?.authors?.author;
    if (author) {
      const authorName = Array.isArray(author) ? author[0] : author;
      (shell as Song).author = typeof authorName === 'string' ? authorName : authorName?.['#text'];
    }

    let verses = song.lyrics?.verse;
    if (!verses) return finalizeSong(shell, []);
    if (!Array.isArray(verses)) verses = [verses];

    const sections: SongSection[] = verses.map((v: Record<string, unknown>) => {
      const name = (v['@_name'] as string) || 'V1';
      const label = parseHeaderLabel(`[${name}]`) ?? name;
      let lines = v.lines;
      if (Array.isArray(lines)) {
        // Multiple <lines> blocks within one verse (rare) — join with a blank line.
        lines = lines.map((l) => extractLinesText(l)).join('\n\n');
      } else {
        lines = extractLinesText(lines);
      }
      return makeSection(label, String(lines ?? ''));
    });

    return finalizeSong(shell, sections);
  } catch {
    return null;
  }
}

function extractLinesText(linesNode: unknown): string {
  if (linesNode == null) return '';
  if (typeof linesNode === 'string') return linesNode;
  if (typeof linesNode === 'object') {
    const text = (linesNode as Record<string, unknown>)['#text'];
    if (typeof text === 'string') return text;
    // <lines><br/> separated content collapses to an object in some exports; best effort:
    return Object.values(linesNode as Record<string, unknown>)
      .filter((v) => typeof v === 'string')
      .join('\n');
  }
  return String(linesNode);
}

/** Parses a CSV with columns: title, author (optional), lyrics — lyrics blocks separated by blank lines. */
export function parseCsvSongs(content: string): Song[] {
  const rows = splitCsvRows(content);
  if (!rows.length) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const titleIdx = header.indexOf('title');
  const authorIdx = header.indexOf('author');
  const lyricsIdx = header.indexOf('lyrics');
  if (titleIdx === -1 || lyricsIdx === -1) return [];

  const songs: Song[] = [];
  for (const row of rows.slice(1)) {
    const title = row[titleIdx]?.trim();
    if (!title) continue;
    const song = parsePlainTextSong(row[lyricsIdx] ?? '', title);
    if (authorIdx >= 0 && row[authorIdx]?.trim()) song.author = row[authorIdx].trim();
    songs.push(song);
  }
  return songs;
}

/** Minimal RFC4180-ish CSV parser: handles quoted fields, escaped quotes, and embedded newlines. */
function splitCsvRows(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const text = content.replace(/\r\n/g, '\n');

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim().length));
}

export interface SongImportResult {
  songs: Song[];
  errors: string[];
}

export function importSongFile(filePath: string): SongImportResult {
  const ext = path.extname(filePath).toLowerCase();
  const baseTitle = path.basename(filePath, ext).replace(/[_-]+/g, ' ').trim();
  const errors: string[] = [];

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    if (ext === '.csv') {
      const songs = parseCsvSongs(content);
      if (!songs.length) errors.push(`${filePath}: no valid rows found (expected columns: title, lyrics)`);
      return { songs, errors };
    }

    // Real OpenSong libraries export one file per song with NO extension, XML-wrapped — so treat
    // ext === '.xml' OR (no extension but the content itself looks like XML) as "try XML parsers
    // first". OpenLyrics and OpenSong both root on <song>, so try OpenLyrics's more distinctive
    // <properties> shape first and fall back to OpenSong's flatter one.
    if (ext === '.xml' || (ext === '' && /^\s*<(\?xml|song)/i.test(content))) {
      const openLyrics = parseOpenLyricsXml(content, baseTitle);
      if (openLyrics) return { songs: [openLyrics], errors };
      const openSong = parseOpenSongXml(content, baseTitle);
      if (openSong) return { songs: [openSong], errors };
      if (ext === '.xml') {
        errors.push(`${filePath}: not a recognized OpenLyrics or OpenSong XML file`);
        return { songs: [], errors };
      }
      // No extension, looked like XML, but matched neither shape — fall through and treat it as
      // plain text rather than erroring outright, in case it's just a coincidental '<' at the start.
    }

    // .txt, .cho, .chordpro, .usr, or a no-extension plain-text lyric sheet
    return { songs: [parsePlainTextSong(content, baseTitle)], errors };
  } catch (err) {
    errors.push(`${filePath}: ${err instanceof Error ? err.message : String(err)}`);
    return { songs: [], errors };
  }
}

export function importSongsFromFolder(folderPath: string): SongImportResult {
  const songs: Song[] = [];
  const errors: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(folderPath, { withFileTypes: true });
  } catch (err) {
    return { songs: [], errors: [`${folderPath}: ${err instanceof Error ? err.message : String(err)}`] };
  }
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const full = path.join(folderPath, entry.name);
    const stat = fs.statSync(full);
    if (stat.size > 2_000_000) continue; // skip anything that clearly isn't a single lyric sheet
    const result = importSongFile(full);
    songs.push(...result.songs);
    errors.push(...result.errors);
  }
  return { songs, errors };
}
