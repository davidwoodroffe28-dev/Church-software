import { useState } from 'react';
import type { Song } from '@shared/types';
import { newSongSection } from '../store';

interface Props {
  song: Song;
  onSave: (song: Song) => void;
  onCancel: () => void;
}

export function SongEditor({ song, onSave, onCancel }: Props) {
  const [title, setTitle] = useState(song.title);
  const [author, setAuthor] = useState(song.author ?? '');
  const [sections, setSections] = useState(song.sections);

  function updateSection(id: string, field: 'label' | 'text', value: string) {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  }

  function addSection() {
    setSections((prev) => [...prev, newSongSection(`Verse ${prev.length + 1}`)]);
  }

  function removeSection(id: string) {
    setSections((prev) => prev.filter((s) => s.id !== id));
  }

  function moveSection(id: string, dir: -1 | 1) {
    setSections((prev) => {
      const items = [...prev];
      const idx = items.findIndex((s) => s.id === id);
      const swap = idx + dir;
      if (idx < 0 || swap < 0 || swap >= items.length) return prev;
      [items[idx], items[swap]] = [items[swap], items[idx]];
      return items;
    });
  }

  function save() {
    onSave({
      ...song,
      title: title.trim() || 'Untitled Song',
      author: author.trim() || undefined,
      sections,
      sequence: sections.map((s) => s.id),
      updatedAt: Date.now(),
    });
  }

  return (
    <div className="modal-backdrop">
      <div className="modal song-editor">
        <h2>Edit Song</h2>
        <label>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </label>
        <label>
          Author
          <input value={author} onChange={(e) => setAuthor(e.target.value)} />
        </label>

        <div className="sections-list">
          {sections.map((section, idx) => (
            <div className="section-row" key={section.id}>
              <input
                className="section-label"
                value={section.label}
                onChange={(e) => updateSection(section.id, 'label', e.target.value)}
              />
              <textarea
                rows={4}
                value={section.text}
                placeholder="Lyrics for this section…"
                onChange={(e) => updateSection(section.id, 'text', e.target.value)}
              />
              <div className="section-actions">
                <button onClick={() => moveSection(section.id, -1)} disabled={idx === 0} title="Move up">↑</button>
                <button onClick={() => moveSection(section.id, 1)} disabled={idx === sections.length - 1} title="Move down">↓</button>
                <button onClick={() => removeSection(section.id)} title="Remove section">✕</button>
              </div>
            </div>
          ))}
        </div>
        <button onClick={addSection}>+ Add section</button>

        <div className="modal-actions">
          <button onClick={onCancel}>Cancel</button>
          <button className="primary" onClick={save}>Save</button>
        </div>
      </div>
    </div>
  );
}
