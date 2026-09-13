import { useStore, useActivePlaylist } from '../store';
import { buildLiveSlide, getSubSlideCount } from '../slideBuilder';
import { SlideView } from '../../shared-ui/SlideView';

export function SlideGridPanel() {
  const library = useStore((s) => s.library);
  const activePlaylist = useActivePlaylist();
  const selection = useStore((s) => s.selection);
  const select = useStore((s) => s.select);
  const liveItemId = useStore((s) => s.liveItemId);
  const liveSubIndex = useStore((s) => s.liveSubIndex);
  const correctPresentationSlideCount = useStore((s) => s.correctPresentationSlideCount);

  if (!library) return <div className="panel grid-panel">Loading…</div>;

  const selectedItem = activePlaylist?.items.find((i) => i.id === selection.itemId) ?? null;

  if (!selectedItem) {
    return (
      <div className="panel grid-panel">
        <div className="grid-empty-hint">Select an item in the Schedule to preview its slides here.</div>
      </div>
    );
  }

  const subCount = getSubSlideCount(selectedItem, library);
  const previewSlide = buildLiveSlide(selectedItem, selection.subIndex, library);
  const thumbnails = Array.from({ length: subCount }, (_, idx) => ({
    idx,
    slide: buildLiveSlide(selectedItem, idx, library),
  }));

  return (
    <div className="panel grid-panel">
      <h3>{selectedItem.label}</h3>

      <div className="big-preview-frame">
        <SlideView
          slide={previewSlide}
          mode="full"
          onPresentationPageCount={(count) => {
            if (previewSlide.kind === 'presentation' && selectedItem.presentationId) {
              const pres = library.presentations.find((p) => p.id === selectedItem.presentationId);
              if (pres && pres.slideCount !== count) correctPresentationSlideCount(pres.id, count);
            }
          }}
        />
      </div>

      {subCount > 1 && (
        <div className="slide-thumb-grid">
          {thumbnails.map(({ idx, slide }) => {
            const isSelected = selection.subIndex === idx;
            const isOnAir = liveItemId === selectedItem.id && liveSubIndex === idx;
            return (
              <button
                key={idx}
                className={'slide-thumb' + (isSelected ? ' selected' : '') + (isOnAir ? ' on-air' : '')}
                onClick={() => select(selectedItem.id, idx)}
              >
                <div className="slide-thumb-frame">
                  <SlideView slide={slide} mode="full" />
                </div>
                <span className="slide-thumb-label">{slide.label?.split('—').pop()?.trim() || `Slide ${idx + 1}`}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
