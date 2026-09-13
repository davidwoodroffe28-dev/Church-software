import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import type { BibleVerse } from '@shared/types';

export interface TranslationInfo {
  code: string;
  name: string;
}

// Bundled from a Bible SuperSearch export (see resources/bible/SOURCE-README.txt for license terms —
// shareable for non-commercial use; confirm redistribution terms before shipping this commercially,
// particularly for the NET Bible).
export const TRANSLATIONS: TranslationInfo[] = [
  { code: 'kjv', name: 'King James Version (1769)' },
  { code: 'kjvpce', name: 'King James Version — Pure Cambridge Edition' },
  { code: 'asv', name: 'American Standard Version (1901)' },
  { code: 'web', name: 'World English Bible' },
  { code: 'geneva', name: 'Geneva Bible (1587)' },
  { code: 'bishops', name: "Bishops' Bible (1568)" },
  { code: 'coverdale', name: 'Coverdale Bible (1535)' },
  { code: 'tyndale', name: 'Tyndale Bible (1534, partial)' },
  { code: 'net', name: 'NET Bible' },
];

interface RawVerse {
  book_name: string;
  book: number;
  chapter: number;
  verse: number;
  text: string;
}

interface LoadedTranslation {
  verses: BibleVerse[];
  bookOrder: string[];
}

const cache = new Map<string, LoadedTranslation>();

function resourcesDir(): string {
  // Unpackaged app: <project root>/resources/bible. If later packaged with asar, unpack this dir
  // (asarUnpack) or move it under process.resourcesPath.
  return path.join(app.getAppPath(), 'resources', 'bible');
}

function cleanText(text: string): string {
  return text.replace(/^�?\s*/, '').replace(/¶\s*/g, '').trim();
}

function loadTranslation(code: string): LoadedTranslation {
  const cached = cache.get(code);
  if (cached) return cached;

  const filePath = path.join(resourcesDir(), `${code}.json`);
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as { verses: RawVerse[] };

  const bookOrder: string[] = [];
  const seen = new Set<string>();
  const verses: BibleVerse[] = raw.verses.map((v) => {
    if (!seen.has(v.book_name)) {
      seen.add(v.book_name);
      bookOrder.push(v.book_name);
    }
    return { book: v.book_name, chapter: v.chapter, verse: v.verse, text: cleanText(v.text) };
  });

  const loaded: LoadedTranslation = { verses, bookOrder };
  cache.set(code, loaded);
  return loaded;
}

export function getBooks(translationCode: string): string[] {
  return loadTranslation(translationCode).bookOrder;
}

export function searchVerses(translationCode: string, query: string): BibleVerse[] {
  const { verses } = loadTranslation(translationCode);
  const q = query.trim().toLowerCase();
  if (!q) return [];

  // "Book Chapter:Verse[-Verse]" style reference, e.g. "John 3:16" or "Psalms 23" or "1 John 2:1-3"
  const refMatch = q.match(/^((?:[1-3]\s?)?[a-z]+(?:\s[a-z]+)?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/i);
  if (refMatch) {
    const [, bookRaw, chapterRaw, verseStartRaw, verseEndRaw] = refMatch;
    const book = bookRaw.trim();
    const chapter = Number(chapterRaw);
    const verseStart = verseStartRaw ? Number(verseStartRaw) : undefined;
    const verseEnd = verseEndRaw ? Number(verseEndRaw) : verseStart;
    const matches = verses.filter(
      (v) =>
        v.book.toLowerCase().startsWith(book) &&
        v.chapter === chapter &&
        (verseStart === undefined || (v.verse >= verseStart && v.verse <= (verseEnd ?? verseStart)))
    );
    if (matches.length) return matches;
  }

  // Fallback: keyword search across verse text
  return verses.filter((v) => v.text.toLowerCase().includes(q)).slice(0, 100);
}
