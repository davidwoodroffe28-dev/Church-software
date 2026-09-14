import { useEffect, useState } from 'react';
import type { BibleVerse } from '@shared/types';
import { useStore } from '../store';

/** "16" for a single verse, "16-18" for a contiguous run, "16,18,21" for a scattered pick. */
function formatVerseRange(verseNumbers: number[]): string {
  const sorted = [...verseNumbers].sort((a, b) => a - b);
  if (sorted.length <= 1) return String(sorted[0] ?? '');
  const isContiguous = sorted.every((v, i) => i === 0 || v === sorted[i - 1] + 1);
  return isContiguous ? `${sorted[0]}-${sorted[sorted.length - 1]}` : sorted.join(',');
}

export function BibleScreen() {
  const addPlaylistItem = useStore((s) => s.addPlaylistItem);
  const select = useStore((s) => s.select);
  const goLive = useStore((s) => s.goLive);
  const setActiveScreen = useStore((s) => s.setActiveScreen);

  const [translations, setTranslations] = useState<{ code: string; name: string }[]>([]);
  const [translation, setTranslation] = useState('kjv');
  const [books, setBooks] = useState<string[]>([]);
  const [book, setBook] = useState<string | null>(null);
  const [chapterCount, setChapterCount] = useState(0);
  const [chapter, setChapter] = useState<number | null>(null);
  const [verses, setVerses] = useState<BibleVerse[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [lastClicked, setLastClicked] = useState<number | null>(null);

  useEffect(() => {
    window.api.bible.getTranslations().then((t) => {
      setTranslations(t);
      if (t[0]) setTranslation(t[0].code);
    });
  }, []);

  useEffect(() => {
    if (!translation) return;
    window.api.bible.getBooks(translation).then((b) => {
      setBooks(b);
      setBook((prev) => prev ?? b[0] ?? null);
    });
  }, [translation]);

  useEffect(() => {
    if (!translation || !book) return;
    window.api.bible.getChapterCount(translation, book).then((count) => {
      setChapterCount(count);
      setChapter(1);
    });
  }, [translation, book]);

  useEffect(() => {
    if (!translation || !book || !chapter) return;
    window.api.bible.getChapterVerses(translation, book, chapter).then(setVerses);
    setSelected(new Set());
    setLastClicked(null);
  }, [translation, book, chapter]);

  const translationName = translations.find((t) => t.code === translation)?.name ?? translation.toUpperCase();

  function toggleVerse(v: BibleVerse, shiftKey: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (shiftKey && lastClicked !== null) {
        const lo = Math.min(lastClicked, v.verse);
        const hi = Math.max(lastClicked, v.verse);
        for (const other of verses) {
          if (other.verse >= lo && other.verse <= hi) next.add(other.verse);
        }
      } else if (next.has(v.verse)) {
        next.delete(v.verse);
      } else {
        next.add(v.verse);
      }
      return next;
    });
    setLastClicked(v.verse);
  }

  function selectedVerses(): BibleVerse[] {
    return verses.filter((v) => selected.has(v.verse)).sort((a, b) => a.verse - b.verse);
  }

  function buildPlaylistItemData(picked: BibleVerse[]) {
    const numbers = picked.map((v) => v.verse);
    const ref = `${picked[0].book} ${picked[0].chapter}:${formatVerseRange(numbers)}`;
    const text = picked.map((v) => `${v.verse} ${v.text}`).join('\n\n');
    return {
      type: 'verse' as const,
      label: ref,
      bible: {
        translation: translationName,
        book: picked[0].book,
        chapter: picked[0].chapter,
        verseStart: Math.min(...numbers),
        verseEnd: Math.max(...numbers),
        text,
      },
    };
  }

  function addSelection() {
    const picked = selectedVerses();
    if (!picked.length) return;
    addPlaylistItem(buildPlaylistItemData(picked));
    setSelected(new Set());
  }

  async function goLiveSelection() {
    const picked = selectedVerses();
    if (!picked.length) return;
    const item = await addPlaylistItem(buildPlaylistItemData(picked));
    select(item.id, 0);
    await goLive();
    setActiveScreen('live');
    setSelected(new Set());
  }

  return (
    <div className="bible-screen">
      <div className="bible-books-column">
        <div className="column-header">
          <span className="mono column-title">TRANSLATION</span>
        </div>
        <select value={translation} onChange={(e) => setTranslation(e.target.value)}>
          {translations.map((t) => (
            <option key={t.code} value={t.code}>{t.name}</option>
          ))}
        </select>

        <div className="column-header" style={{ marginTop: 'var(--sp-4)' }}>
          <span className="mono column-title">BOOK</span>
        </div>
        <div className="book-list">
          {books.map((b) => (
            <button key={b} className={'book-row' + (b === book ? ' book-row-active' : '')} onClick={() => setBook(b)}>
              {b}
            </button>
          ))}
        </div>
      </div>

      <div className="chapter-grid-column">
        <div className="column-header">
          <span className="mono column-title">{book ? book.toUpperCase() : 'CHAPTERS'}</span>
        </div>
        <div className="chapter-grid">
          {Array.from({ length: chapterCount }, (_, i) => i + 1).map((n) => (
            <button key={n} className={'chapter-chip' + (n === chapter ? ' chapter-chip-active' : '')} onClick={() => setChapter(n)}>
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="verse-list-column">
        <div className="column-header">
          <span className="mono column-title">{book && chapter ? `${book.toUpperCase()} ${chapter}` : 'VERSES'}</span>
          <span className="mono column-count">{verses.length}</span>
        </div>
        <div className="hint">Click a verse to highlight it, shift-click to select a range — then Add or Go live below.</div>
        <div className="verse-list">
          {verses.map((v) => (
            <div
              key={v.verse}
              className={'verse-row' + (selected.has(v.verse) ? ' verse-row-selected' : '')}
              onClick={(e) => toggleVerse(v, e.shiftKey)}
            >
              <div className="verse-row-text serif">
                <span className="mono verse-number">{v.verse}</span> {v.text}
              </div>
            </div>
          ))}
        </div>
        {selected.size > 0 && (
          <div className="verse-selection-bar">
            <span className="mono verse-selection-count">
              {selected.size} VERSE{selected.size === 1 ? '' : 'S'} SELECTED
            </span>
            <div className="verse-selection-actions">
              <button onClick={() => setSelected(new Set())}>Clear</button>
              <button onClick={addSelection}>Add</button>
              <button className="primary" onClick={goLiveSelection}>Go live</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
