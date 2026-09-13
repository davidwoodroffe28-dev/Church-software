import { useEffect, useState } from 'react';
import type { Song, SongSection } from '@shared/types';
import { useStore, useActivePlaylist, newSong, newSongSection } from '../store';
import { buildLiveSlide } from '../slideBuilder';
import { SlideView } from '../../shared-ui/SlideView';

export function SongsScreen() {
  const library = useStore((s) => s.library);
  const upsertSong = useStore((s) => s.upsertSong);
  const deleteSong = useStore((s) => s.deleteSong);
  const importSongsFiles = useStore((s) => s.importSongsFiles);
  const importSongsFolder = useStore((s) => s.importSongsFolder);
  const importEasyWorship = useStore((s) => s.importEasyWorship);

  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Song | null>(null);
  const [focusedSectionId, setFocusedSectionId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const songs = (library?.songs ?? []).filter((s) => s.title.toLowerCase().includes(query.toLowerCase()));

  function loadSong(song: Song) {
    setSelectedId(song.id);
    setDraft(structuredClone(song));
    setFocusedSectionId(song.sequence[0] ?? song.sections[0]?.id ?? null);
    setDirty(false);
  }

  function startNewSong() {
    const song = newSong('New Song');
    upsertSong(song);
    loadSong(song);
  }

  function updateDraft(patch: Partial<Song>) {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
    setDirty(true);
  }

  function updateSection(id: string, field: 'label' | 'text' | 'secondaryText', value: string) {
    if (!draft) return;
    updateDraft({ sections: draft.sections.map((s) => (s.id === id ? { ...s, [field]: value } : s)) });
  }

  function addSection() {
    if (!draft) return;
    const section = newSongSection(`Section ${draft.sections.length + 1}`);
    updateDraft({ sections: [...draft.sections, section], sequence: [...draft.sequence, section.id] });
    setFocusedSectionId(section.id);
  }

  function removeSection(id: string) {
    if (!draft) return;
    updateDraft({
      sections: draft.sections.filter((s) => s.id !== id),
      sequence: draft.sequence.filter((sid) => sid !== id),
    });
    if (focusedSectionId === id) setFocusedSectionId(null);
  }

  function moveSection(id: string, direction: -1 | 1) {
    if (!draft) return;
    const order = [...draft.sequence];
    const idx = order.indexOf(id);
    const swap = idx + direction;
    if (idx < 0 || swap < 0 || swap >= order.length) return;
    [order[idx], order[swap]] = [order[swap], order[idx]];
    updateDraft({ sequence: order });
  }

  function save() {
    if (!draft) return;
    upsertSong({ ...draft, updatedAt: Date.now() });
    setDirty(false);
  }

  useEffect(() => {
    if (!library || selectedId) return;
    if (library.songs[0]) loadSong(library.songs[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [library]);

  if (!library) return null;

  const orderedSections: SongSection[] = draft
    ? (draft.sequence.length ? draft.sequence : draft.sections.map((s) => s.id))
        .map((id) => draft.sections.find((s) => s.id === id))
        .filter((s): s is SongSection => !!s)
    : [];
  const focusedSection = orderedSections.find((s) => s.id === focusedSectionId) ?? orderedSections[0] ?? null;

  return (
    <div className="songs-screen">
      <div className="songs-list-column">
        <div className="column-header">
          <span className="mono column-title">SONGS</span>
          <span className="mono column-count">{songs.length}</span>
        </div>
        <input className="library-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search songs…" />
        <div className="import-row">
          <button onClick={startNewSong}>+ New</button>
          <button onClick={() => importSongsFiles().then((r) => setImportStatus(`Imported ${r.imported} song(s).`))}>Import…</button>
          <button onClick={() => importSongsFolder().then((r) => setImportStatus(`Imported ${r.imported} song(s).`))}>Folder…</button>
          <button onClick={() => importEasyWorship().then((r) => setImportStatus(`Imported ${r.imported} song(s).`))}>EasyWorship…</button>
        </div>
        {importStatus && <p className="hint">{importStatus}</p>}
        <div className="songs-list">
          {songs.map((song) => (
            <div
              key={song.id}
              className={'library-row' + (song.id === selectedId ? ' songs-row-active' : '')}
              onClick={() => loadSong(song)}
            >
              <span className="type-stripe" style={{ background: 'var(--type-song)' }} />
              <div className="library-row-body">
                <div className="library-row-title">{song.title}</div>
                <div className="mono library-row-meta">{song.sections.length} SECTION{song.sections.length === 1 ? '' : 'S'}</div>
              </div>
              <button className="row-icon-btn" onClick={(e) => { e.stopPropagation(); deleteSong(song.id); if (song.id === selectedId) setSelectedId(null); }} title="Delete">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      {draft ? (
        <>
          <div className="song-editor-column">
            <div className="column-header">
              <span className="mono column-title">EDITOR</span>
              <button className="primary" onClick={save} disabled={!dirty}>{dirty ? 'Save' : 'Saved'}</button>
            </div>
            <input
              className="song-title-field serif"
              value={draft.title}
              onChange={(e) => updateDraft({ title: e.target.value })}
              placeholder="Song title"
            />
            <input
              className="song-author-field"
              value={draft.author ?? ''}
              onChange={(e) => updateDraft({ author: e.target.value })}
              placeholder="Author (optional)"
            />

            <div className="mono column-title" style={{ marginTop: 'var(--sp-3)' }}>ARRANGEMENT</div>
            <div className="sections-arrangement">
              {orderedSections.map((section, idx) => (
                <div
                  key={section.id}
                  className={'arrangement-row' + (section.id === focusedSectionId ? ' arrangement-row-active' : '')}
                  onClick={() => setFocusedSectionId(section.id)}
                >
                  <span className="mono arrangement-index">{idx + 1}</span>
                  <span className="arrangement-label">{section.label}</span>
                  <div className="section-actions">
                    <button onClick={(e) => { e.stopPropagation(); moveSection(section.id, -1); }} disabled={idx === 0} title="Move up">↑</button>
                    <button onClick={(e) => { e.stopPropagation(); moveSection(section.id, 1); }} disabled={idx === orderedSections.length - 1} title="Move down">↓</button>
                    <button onClick={(e) => { e.stopPropagation(); removeSection(section.id); }} title="Remove">✕</button>
                  </div>
                </div>
              ))}
              <button onClick={addSection}>+ Add section</button>
            </div>

            {focusedSection && (
              <div className="section-detail">
                <input
                  className="section-label-field"
                  value={focusedSection.label}
                  onChange={(e) => updateSection(focusedSection.id, 'label', e.target.value)}
                  placeholder="Section label (e.g. Verse 1)"
                />
                <textarea
                  className="section-text-field"
                  value={focusedSection.text}
                  onChange={(e) => updateSection(focusedSection.id, 'text', e.target.value)}
                  placeholder="Lyrics for this section…"
                />
                <div className="mono column-title" style={{ marginTop: 'var(--sp-2)' }}>
                  SECOND LANGUAGE (OPTIONAL)
                </div>
                <textarea
                  className="section-text-field"
                  value={focusedSection.secondaryText ?? ''}
                  onChange={(e) => updateSection(focusedSection.id, 'secondaryText', e.target.value)}
                  placeholder="Same section in a second language, shown stacked below when the theme has it turned on…"
                />
              </div>
            )}
          </div>

          <div className="songs-live-column">
            <LiveSplit draft={draft} focusedSection={focusedSection} />
          </div>
        </>
      ) : (
        <div className="song-editor-column">
          <div className="empty-hint">Select a song, or create a new one.</div>
        </div>
      )}
    </div>
  );
}

function LiveSplit({ draft, focusedSection }: { draft: Song; focusedSection: SongSection | null }) {
  const library = useStore((s) => s.library);
  const playlist = useActivePlaylist();
  const liveItemId = useStore((s) => s.liveItemId);
  const liveSubIndex = useStore((s) => s.liveSubIndex);
  const liveTextVisible = useStore((s) => s.liveTextVisible);
  const liveBackgroundVisible = useStore((s) => s.liveBackgroundVisible);

  if (!library) return null;

  const liveItem = playlist?.items.find((i) => i.id === liveItemId) ?? null;
  const liveSlide = liveItem ? buildLiveSlide(liveItem, liveSubIndex, library) : { kind: 'blank' as const };

  const template = library.templates.find((t) => t.id === draft.templateId) ?? library.templates.find((t) => t.id === 'default-lyrics');
  const previewSlide = focusedSection
    ? {
        kind: 'song' as const,
        text: focusedSection.text,
        secondaryText: focusedSection.secondaryText,
        label: `${draft.title} — ${focusedSection.label}`,
        background: template?.background,
        template,
      }
    : { kind: 'blank' as const };

  return (
    <>
      <div className="column-header">
        <span className="mono slide-pane-label-preview">PREVIEW OF EDIT</span>
      </div>
      <div className="slide-monitor songs-monitor">
        <SlideView slide={previewSlide} mode="full" />
      </div>

      <div className="column-header" style={{ marginTop: 'var(--sp-4)' }}>
        <span className="mono slide-pane-label-live">LIVE NOW</span>
      </div>
      <div className="slide-monitor songs-monitor">
        <SlideView slide={liveSlide} mode="full" textVisible={liveTextVisible} backgroundVisible={liveBackgroundVisible} />
      </div>
    </>
  );
}
