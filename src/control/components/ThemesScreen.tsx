import { useEffect, useState } from 'react';
import type { Template } from '@shared/types';
import { useStore, newTemplate } from '../store';
import { SlideView } from '../../shared-ui/SlideView';
import { Toggle } from './Toggle';

const FONT_CHOICES = ['Georgia, serif', "'IBM Plex Sans', sans-serif", "'Source Serif 4', serif", 'Helvetica, Arial, sans-serif', 'Verdana, sans-serif'];

const SAMPLE_TEXT = 'Amazing grace, how sweet the sound\nthat saved a wretch like me;';
const SAMPLE_SECONDARY_TEXT = 'Sublime gracia, cuán dulce el sonido\nque a un desdichado salvó;';

export function ThemesScreen() {
  const library = useStore((s) => s.library);
  const upsertTemplate = useStore((s) => s.upsertTemplate);
  const deleteTemplate = useStore((s) => s.deleteTemplate);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Template | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!library || selectedId) return;
    if (library.templates[0]) {
      setSelectedId(library.templates[0].id);
      setDraft(structuredClone(library.templates[0]));
    }
  }, [library, selectedId]);

  if (!library) return null;

  function select(t: Template) {
    setSelectedId(t.id);
    setDraft(structuredClone(t));
    setDirty(false);
  }

  function createTheme() {
    const t = newTemplate(`Theme ${library!.templates.length + 1}`);
    upsertTemplate(t);
    select(t);
  }

  function update(patch: Partial<Template>) {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
    setDirty(true);
  }

  function save() {
    if (!draft) return;
    upsertTemplate(draft);
    setDirty(false);
  }

  const mediaForBackground = draft
    ? library.media.filter((m) => (draft.background.type === 'video' ? m.type === 'video' : m.type === 'image'))
    : [];

  return (
    <div className="themes-screen">
      <div className="themes-list-column">
        <div className="column-header">
          <span className="mono column-title">THEMES</span>
          <button onClick={createTheme}>+ New</button>
        </div>
        <div className="themes-list">
          {library.templates.map((t) => (
            <div key={t.id} className={'library-row' + (t.id === selectedId ? ' songs-row-active' : '')} onClick={() => select(t)}>
              <span className="type-stripe" style={{ background: t.background.type === 'color' ? t.background.value : 'var(--type-slides)' }} />
              <div className="library-row-body">
                <div className="library-row-title">{t.name}</div>
                <div className="mono library-row-meta">{t.lowerThird ? 'LOWER THIRD' : t.textAlign.toUpperCase()}</div>
              </div>
              <button className="row-icon-btn" onClick={(e) => { e.stopPropagation(); deleteTemplate(t.id); if (t.id === selectedId) { setSelectedId(null); setDraft(null); } }} title="Delete">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      {draft ? (
        <>
          <div className="themes-preview-column">
            <div className="column-header">
              <span className="mono column-title">PREVIEW</span>
              <button className="primary" onClick={save} disabled={!dirty}>{dirty ? 'Save' : 'Saved'}</button>
            </div>
            <div className="slide-monitor themes-monitor">
              <SlideView
                slide={{ kind: 'song', text: SAMPLE_TEXT, secondaryText: SAMPLE_SECONDARY_TEXT, background: draft.background, template: draft }}
                mode="full"
              />
            </div>
          </div>

          <div className="themes-props-column">
            <label>
              Name
              <input value={draft.name} onChange={(e) => update({ name: e.target.value })} />
            </label>

            <div className="mono column-title">FONT</div>
            <label>
              Family
              <select value={draft.fontFamily} onChange={(e) => update({ fontFamily: e.target.value })}>
                {FONT_CHOICES.map((f) => (
                  <option key={f} value={f}>{f.split(',')[0].replace(/'/g, '')}</option>
                ))}
              </select>
            </label>
            <label>
              Size ({draft.fontSize}px)
              <input type="range" min={24} max={120} value={draft.fontSize} onChange={(e) => update({ fontSize: Number(e.target.value) })} />
            </label>
            <label>
              Color
              <input type="color" value={draft.textColor} onChange={(e) => update({ textColor: e.target.value })} />
            </label>

            <div className="mono column-title">ALIGNMENT</div>
            <div className="align-toggle">
              {(['left', 'center', 'right'] as const).map((a) => (
                <button key={a} className={'align-btn' + (draft.textAlign === a ? ' align-btn-active' : '')} onClick={() => update({ textAlign: a })}>
                  {a}
                </button>
              ))}
            </div>

            <div className="mono column-title">EFFECTS</div>
            <Toggle checked={draft.lowerThird} onChange={(v) => update({ lowerThird: v })} label="Lower-third style" />
            <Toggle
              checked={!!draft.showSecondaryLanguage}
              onChange={(v) => update({ showSecondaryLanguage: v })}
              label="Show second language"
            />

            <div className="mono column-title">BACKGROUND</div>
            <div className="align-toggle">
              {(['color', 'image', 'video'] as const).map((t) => (
                <button
                  key={t}
                  className={'align-btn' + (draft.background.type === t ? ' align-btn-active' : '')}
                  onClick={() => update({ background: { type: t, value: t === 'color' ? '#0c0e11' : '' } })}
                >
                  {t}
                </button>
              ))}
            </div>
            {draft.background.type === 'color' ? (
              <label>
                Background color
                <input type="color" value={draft.background.value} onChange={(e) => update({ background: { type: 'color', value: e.target.value } })} />
              </label>
            ) : (
              <label>
                {draft.background.type === 'video' ? 'Video' : 'Image'} from Media library
                <select
                  value={draft.background.value}
                  onChange={(e) => update({ background: { type: draft.background.type, value: e.target.value } })}
                >
                  <option value="">— none —</option>
                  {mediaForBackground.map((m) => (
                    <option key={m.id} value={m.filePath}>{m.name}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </>
      ) : (
        <div className="themes-preview-column">
          <div className="empty-hint">Create a theme to get started.</div>
        </div>
      )}
    </div>
  );
}
