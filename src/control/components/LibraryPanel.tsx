import { useEffect, useState } from 'react';
import type { BibleVerse, Song } from '@shared/types';
import { useStore, newSong, mediaItemLabel } from '../store';
import { SongEditor } from './SongEditor';

type Tab = 'songs' | 'media' | 'bible' | 'presentations';

export function LibraryPanel() {
  const [tab, setTab] = useState<Tab>('songs');
  return (
    <div className="panel library-panel">
      <div className="tab-bar">
        <button className={tab === 'songs' ? 'active' : ''} onClick={() => setTab('songs')}>Songs</button>
        <button className={tab === 'media' ? 'active' : ''} onClick={() => setTab('media')}>Media</button>
        <button className={tab === 'bible' ? 'active' : ''} onClick={() => setTab('bible')}>Bible</button>
        <button className={tab === 'presentations' ? 'active' : ''} onClick={() => setTab('presentations')}>Slides</button>
      </div>
      {tab === 'songs' && <SongsTab />}
      {tab === 'media' && <MediaTab />}
      {tab === 'bible' && <BibleTab />}
      {tab === 'presentations' && <PresentationsTab />}
    </div>
  );
}

function SongsTab() {
  const library = useStore((s) => s.library);
  const upsertSong = useStore((s) => s.upsertSong);
  const deleteSong = useStore((s) => s.deleteSong);
  const addPlaylistItem = useStore((s) => s.addPlaylistItem);
  const importSongsFiles = useStore((s) => s.importSongsFiles);
  const importSongsFolder = useStore((s) => s.importSongsFolder);
  const importEasyWorship = useStore((s) => s.importEasyWorship);
  const [editing, setEditing] = useState<Song | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  function reportImport(result: { imported: number; errors: string[]; warning?: string }) {
    const parts = [`Imported ${result.imported} song(s).`];
    if (result.warning) parts.push(result.warning);
    if (result.errors.length) parts.push(`${result.errors.length} file(s) failed: ${result.errors.slice(0, 3).join('; ')}`);
    setImportStatus(parts.join(' '));
  }

  return (
    <div className="tab-body">
      <div className="import-buttons">
        <button onClick={() => setEditing(newSong('New Song'))}>+ New Song</button>
        <button onClick={() => importSongsFiles().then(reportImport)} title="OpenLyrics XML, ChordPro, OpenSong-style text, or CSV (title,author,lyrics)">
          Import songs…
        </button>
        <button onClick={() => importSongsFolder().then(reportImport)} title="Import every song file in a folder (e.g. an OpenSong library)">
          Import folder…
        </button>
        <button onClick={() => importEasyWorship().then(reportImport)} title="Best-effort import from an EasyWorship 7 (SQLite) song database">
          Import from EasyWorship…
        </button>
      </div>
      {importStatus && <p className="hint">{importStatus}</p>}
      <ul className="item-list">
        {library?.songs.map((song) => (
          <li key={song.id}>
            <span className="item-title" onClick={() => setEditing(song)}>{song.title}</span>
            <div className="item-actions">
              <button
                onClick={() =>
                  addPlaylistItem({ type: 'song', refId: song.id, label: song.title })
                }
                title="Add to service"
              >
                +
              </button>
              <button onClick={() => setEditing(song)} title="Edit">✎</button>
              <button onClick={() => deleteSong(song.id)} title="Delete">✕</button>
            </div>
          </li>
        ))}
      </ul>
      {editing && (
        <SongEditor
          song={editing}
          onCancel={() => setEditing(null)}
          onSave={(song) => {
            upsertSong(song);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function MediaTab() {
  const library = useStore((s) => s.library);
  const importMediaFiles = useStore((s) => s.importMediaFiles);
  const deleteMedia = useStore((s) => s.deleteMedia);
  const addPlaylistItem = useStore((s) => s.addPlaylistItem);

  return (
    <div className="tab-body">
      <button onClick={importMediaFiles}>+ Add media…</button>
      <ul className="item-list">
        {library?.media.map((m) => (
          <li key={m.id}>
            <span className="item-title">{mediaItemLabel(m)}</span>
            <div className="item-actions">
              <button onClick={() => addPlaylistItem({ type: 'media', refId: m.id, label: m.name })} title="Add to service">+</button>
              <button onClick={() => deleteMedia(m.id)} title="Delete">✕</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BibleTab() {
  const [translations, setTranslations] = useState<{ code: string; name: string }[]>([]);
  const [translation, setTranslation] = useState('kjv');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BibleVerse[]>([]);
  const addPlaylistItem = useStore((s) => s.addPlaylistItem);

  useEffect(() => {
    window.api.bible.getTranslations().then(setTranslations);
  }, []);

  async function search() {
    const verses = await window.api.bible.search(translation, query);
    setResults(verses);
  }

  const translationName = translations.find((t) => t.code === translation)?.name ?? translation.toUpperCase();

  return (
    <div className="tab-body">
      <label>
        Translation
        <select value={translation} onChange={(e) => setTranslation(e.target.value)}>
          {translations.map((t) => (
            <option key={t.code} value={t.code}>{t.name}</option>
          ))}
        </select>
      </label>
      <div className="search-row">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          placeholder="e.g. John 3:16, Psalms 23, or a keyword"
        />
        <button onClick={search}>Search</button>
      </div>
      <ul className="item-list">
        {results.map((v) => (
          <li key={`${v.book}-${v.chapter}-${v.verse}`}>
            <span className="item-title">
              <strong>{v.book} {v.chapter}:{v.verse}</strong> — {v.text}
            </span>
            <div className="item-actions">
              <button
                onClick={() =>
                  addPlaylistItem({
                    type: 'verse',
                    label: `${v.book} ${v.chapter}:${v.verse}`,
                    bible: {
                      translation: translationName,
                      book: v.book,
                      chapter: v.chapter,
                      verseStart: v.verse,
                      text: v.text,
                    },
                  })
                }
                title="Add to service"
              >
                +
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PresentationsTab() {
  const library = useStore((s) => s.library);
  const importPresentation = useStore((s) => s.importPresentation);
  const addPlaylistItem = useStore((s) => s.addPlaylistItem);
  const [error, setError] = useState<string | null>(null);

  async function handleImport() {
    setError(null);
    const err = await importPresentation();
    if (err) setError(err);
  }

  return (
    <div className="tab-body">
      <button onClick={handleImport}>+ Import PowerPoint…</button>
      {error && <p className="error-text">{error}</p>}
      <ul className="item-list">
        {library?.presentations.map((p) => (
          <li key={p.id}>
            <span className="item-title">{p.name}{p.slideCount ? ` (${p.slideCount} slides)` : ''}</span>
            <div className="item-actions">
              <button
                onClick={() =>
                  addPlaylistItem({ type: 'presentation', presentationId: p.id, label: p.name, slideIndex: 0 })
                }
                title="Add to service"
              >
                +
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
