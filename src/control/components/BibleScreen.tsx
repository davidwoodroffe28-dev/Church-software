import { useEffect, useState } from 'react';
import type { BibleVerse } from '@shared/types';
import { useStore } from '../store';

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
  }, [translation, book, chapter]);

  const translationName = translations.find((t) => t.code === translation)?.name ?? translation.toUpperCase();

  function verseRef(v: BibleVerse) {
    return `${v.book} ${v.chapter}:${v.verse}`;
  }

  function addVerse(v: BibleVerse) {
    addPlaylistItem({
      type: 'verse',
      label: verseRef(v),
      bible: { translation: translationName, book: v.book, chapter: v.chapter, verseStart: v.verse, text: v.text },
    });
  }

  async function goLiveVerse(v: BibleVerse) {
    const item = await addPlaylistItem({
      type: 'verse',
      label: verseRef(v),
      bible: { translation: translationName, book: v.book, chapter: v.chapter, verseStart: v.verse, text: v.text },
    });
    select(item.id, 0);
    await goLive();
    setActiveScreen('live');
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
        <div className="verse-list">
          {verses.map((v) => (
            <div key={v.verse} className="verse-row">
              <div className="verse-row-text serif">
                <span className="mono verse-number">{v.verse}</span> {v.text}
              </div>
              <div className="verse-row-actions">
                <button onClick={() => addVerse(v)}>Add</button>
                <button className="primary" onClick={() => goLiveVerse(v)}>Go live</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
