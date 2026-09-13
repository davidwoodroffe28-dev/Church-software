import { useState } from 'react';
import type { Presentation, PlaylistItem } from '@shared/types';
import { useStore } from '../store';
import { buildLiveSlide } from '../slideBuilder';
import { SlideView } from '../../shared-ui/SlideView';

/** buildLiveSlide takes a PlaylistItem, not a Presentation directly — this stands in for "the item
 *  this presentation would become if added to the service" so the same slide-building logic (and
 *  its pdf/native rendering branches) can be reused for a bare library preview. */
function previewItemFor(p: Presentation): PlaylistItem {
  return { id: `preview-${p.id}`, type: 'presentation', presentationId: p.id, label: p.name, slideIndex: 0 };
}

export function SlidesScreen() {
  const library = useStore((s) => s.library);
  const importPresentation = useStore((s) => s.importPresentation);
  const deletePresentation = useStore((s) => s.deletePresentation);
  const addPlaylistItem = useStore((s) => s.addPlaylistItem);
  const correctPresentationSlideCount = useStore((s) => s.correctPresentationSlideCount);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  if (!library) return null;

  const presentations = library.presentations;
  const selected = presentations.find((p) => p.id === selectedId) ?? null;

  async function handleImport() {
    setError(null);
    setWarning(null);
    const result = await importPresentation();
    if (result.error) setError(result.error);
    if (result.warning) setWarning(result.warning);
  }

  function select(p: Presentation) {
    setSelectedId(p.id);
    setPageIndex(0);
  }

  return (
    <div className="media-screen">
      <div className="media-main-column">
        <div className="column-header">
          <span className="mono column-title">SLIDES</span>
          <button onClick={handleImport}>+ Import PowerPoint…</button>
        </div>
        {error && <p className="error-text">{error}</p>}
        {warning && <p className="hint">{warning}</p>}

        {presentations.length === 0 ? (
          <div className="empty-hint">
            No presentations yet. Click + Import PowerPoint to bring in a .pptx/.ppt file.
          </div>
        ) : (
          <div className="media-grid">
            {presentations.map((p) => {
              const thumbSlide = buildLiveSlide(previewItemFor(p), 0, library);
              return (
                <button key={p.id} className={'media-tile' + (p.id === selectedId ? ' media-tile-active' : '')} onClick={() => select(p)}>
                  <div className="media-tile-frame">
                    <SlideView slide={thumbSlide} mode="full" />
                  </div>
                  <span className="media-tile-label">
                    {p.name}
                    {p.mode === 'native' && <span className="role-badge">approx.</span>}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="media-detail-column">
        {selected ? (
          <>
            <div className="column-header">
              <span className="mono column-title">SELECTED</span>
            </div>
            <div className="media-detail-frame">
              <SlideView
                slide={buildLiveSlide(previewItemFor(selected), pageIndex, library)}
                mode="full"
                onPresentationPageCount={(count) => {
                  if (selected.slideCount !== count) correctPresentationSlideCount(selected.id, count);
                }}
              />
            </div>
            {selected.slideCount > 1 && (
              <div className="slides-page-nav">
                <button className="transport-btn" onClick={() => setPageIndex((i) => Math.max(0, i - 1))} disabled={pageIndex === 0}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                </button>
                <span className="mono slides-page-count">{pageIndex + 1} / {selected.slideCount}</span>
                <button
                  className="transport-btn"
                  onClick={() => setPageIndex((i) => Math.min(selected.slideCount - 1, i + 1))}
                  disabled={pageIndex === selected.slideCount - 1}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </button>
              </div>
            )}
            <div className="media-detail-name">
              {selected.name}
              {selected.mode === 'native' && <span className="role-badge">approx.</span>}
            </div>
            <div className="mono media-detail-meta">{selected.slideCount} SLIDE{selected.slideCount === 1 ? '' : 'S'}</div>
            <button
              className="primary"
              onClick={() => addPlaylistItem({ type: 'presentation', presentationId: selected.id, label: selected.name, slideIndex: 0 })}
            >
              Add to service
            </button>
            <button
              onClick={() => {
                deletePresentation(selected.id);
                setSelectedId(null);
              }}
            >
              Delete
            </button>
          </>
        ) : (
          <div className="empty-hint">Select a presentation to preview it here.</div>
        )}
      </div>
    </div>
  );
}
