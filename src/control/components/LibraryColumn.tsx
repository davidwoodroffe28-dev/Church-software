import { useEffect, useState } from 'react';
import type { BibleVerse, Song } from '@shared/types';
import { useStore, newSong, mediaItemLabel } from '../store';
import { SongEditor } from './SongEditor';

type Filter = 'songs' | 'scripture' | 'media' | 'slides';

const FILTERS: { id: Filter; label: string; color: string }[] = [
  { id: 'songs', label: 'Songs', color: 'var(--type-song)' },
  { id: 'scripture', label: 'Scripture', color: 'var(--type-scripture)' },
  { id: 'media', label: 'Media', color: 'var(--type-media)' },
  { id: 'slides', label: 'Slides', color: 'var(--type-slides)' },
];

export function LibraryColumn() {
  const [filter, setFilter] = useState<Filter>('songs');
  const [query, setQuery] = useState('');

  return (
    <div className="library-column">
      <div className="column-header">
        <span className="mono column-title">LIBRARY</span>
      </div>

      {filter !== 'scripture' && (
        <input
          className="library-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${filter}…`}
        />
      )}

      <div className="filter-pills">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            className={'filter-pill' + (filter === f.id ? ' filter-pill-active' : '')}
            style={filter === f.id ? { borderColor: f.color } : undefined}
            onClick={() => setFilter(f.id)}
          >
            {f.label.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="library-list">
        {filter === 'songs' && <SongsFilter query={query} />}
        {filter === 'scripture' && <ScriptureFilter />}
        {filter === 'media' && <MediaFilter query={query} />}
        {filter === 'slides' && <SlidesFilter query={query} />}
      </div>
    </div>
  );
}

function LibraryRow({
  color,
  title,
  meta,
  onAdd,
  onClick,
  extra,
}: {
  color: string;
  title: string;
  meta: string;
  onAdd: () => void;
  onClick?: () => void;
  extra?: React.ReactNode;
}) {
  return (
    <div className="library-row" onClick={onClick}>
      <span className="type-stripe" style={{ background: color }} />
      <div className="library-row-body">
        <div className="library-row-title">{title}</div>
        <div className="mono library-row-meta">{meta}</div>
      </div>
      {extra}
      <button
        className="row-add"
        onClick={(e) => {
          e.stopPropagation();
          onAdd();
        }}
        title="Add to service"
      >
        +
      </button>
    </div>
  );
}

function SongsFilter({ query }: { query: string }) {
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

  const songs = (library?.songs ?? []).filter((s) => s.title.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="library-tab-body">
      <div className="import-row">
        <button onClick={() => setEditing(newSong('New Song'))}>+ New song</button>
        <button onClick={() => importSongsFiles().then(reportImport)} title="OpenLyrics XML, ChordPro, OpenSong-style text, or CSV (title,author,lyrics)">
          Import…
        </button>
        <button onClick={() => importSongsFolder().then(reportImport)} title="Import every song file in a folder">
          Import folder…
        </button>
        <button onClick={() => importEasyWorship().then(reportImport)} title="Best-effort import from an EasyWorship 7 (SQLite) song database">
          From EasyWorship…
        </button>
      </div>
      {importStatus && <p className="hint">{importStatus}</p>}
      {songs.map((song) => (
        <LibraryRow
          key={song.id}
          color="var(--type-song)"
          title={song.title}
          meta={`SONG · ${song.sections.length} SECTION${song.sections.length === 1 ? '' : 'S'}`}
          onClick={() => setEditing(song)}
          onAdd={() => addPlaylistItem({ type: 'song', refId: song.id, label: song.title })}
          extra={
            <button className="row-icon-btn" onClick={(e) => { e.stopPropagation(); deleteSong(song.id); }} title="Delete">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
            </button>
          }
        />
      ))}
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

function ScriptureFilter() {
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
    <div className="library-tab-body">
      <select value={translation} onChange={(e) => setTranslation(e.target.value)}>
        {translations.map((t) => (
          <option key={t.code} value={t.code}>{t.name}</option>
        ))}
      </select>
      <div className="search-row">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          placeholder="John 3:16, Psalms 23, or a keyword"
        />
        <button onClick={search}>Search</button>
      </div>
      {results.map((v) => (
        <LibraryRow
          key={`${v.book}-${v.chapter}-${v.verse}`}
          color="var(--type-scripture)"
          title={`${v.book} ${v.chapter}:${v.verse}`}
          meta={`SCRIPTURE · ${v.text.slice(0, 46)}${v.text.length > 46 ? '…' : ''}`}
          onAdd={() =>
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
        />
      ))}
    </div>
  );
}

function MediaFilter({ query }: { query: string }) {
  const library = useStore((s) => s.library);
  const importMediaFiles = useStore((s) => s.importMediaFiles);
  const deleteMedia = useStore((s) => s.deleteMedia);
  const addPlaylistItem = useStore((s) => s.addPlaylistItem);

  const media = (library?.media ?? []).filter((m) => m.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="library-tab-body">
      <div className="import-row">
        <button onClick={importMediaFiles}>+ Add media…</button>
      </div>
      {media.map((m) => (
        <LibraryRow
          key={m.id}
          color="var(--type-media)"
          title={m.name}
          meta={`MEDIA · ${mediaItemLabel(m).toUpperCase()}`}
          onAdd={() => addPlaylistItem({ type: 'media', refId: m.id, label: m.name })}
          extra={
            <button className="row-icon-btn" onClick={(e) => { e.stopPropagation(); deleteMedia(m.id); }} title="Delete">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
            </button>
          }
        />
      ))}
    </div>
  );
}

function SlidesFilter({ query }: { query: string }) {
  const library = useStore((s) => s.library);
  const importPresentation = useStore((s) => s.importPresentation);
  const addPlaylistItem = useStore((s) => s.addPlaylistItem);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  async function handleImport() {
    setError(null);
    setWarning(null);
    const result = await importPresentation();
    if (result.error) setError(result.error);
    if (result.warning) setWarning(result.warning);
  }

  const presentations = (library?.presentations ?? []).filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="library-tab-body">
      <div className="import-row">
        <button onClick={handleImport}>+ Import PowerPoint…</button>
      </div>
      {error && <p className="error-text">{error}</p>}
      {warning && <p className="hint">{warning}</p>}
      {presentations.map((p) => (
        <LibraryRow
          key={p.id}
          color="var(--type-slides)"
          title={p.name}
          meta={`SLIDES · ${p.slideCount || '?'} SLIDES${p.mode === 'native' ? ' · APPROX.' : ''}`}
          onAdd={() => addPlaylistItem({ type: 'presentation', presentationId: p.id, label: p.name, slideIndex: 0 })}
        />
      ))}
    </div>
  );
}
