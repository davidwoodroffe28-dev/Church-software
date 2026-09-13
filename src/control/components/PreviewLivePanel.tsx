import { useState } from 'react';
import { useStore } from '../store';
import { buildLiveSlide } from '../slideBuilder';
import { SlideView } from '../../shared-ui/SlideView';
import { OutputsSettings } from './OutputsSettings';

export function PreviewLivePanel() {
  const library = useStore((s) => s.library);
  const activePlaylist = useStore((s) => s.activePlaylist)();
  const selection = useStore((s) => s.selection);
  const liveItemId = useStore((s) => s.liveItemId);
  const liveSubIndex = useStore((s) => s.liveSubIndex);
  const goLive = useStore((s) => s.goLive);
  const clearLive = useStore((s) => s.clearLive);
  const stageMessage = useStore((s) => s.stageMessage);
  const setStageMessage = useStore((s) => s.setStageMessage);
  const stageClock = useStore((s) => s.stageClock);
  const setStageClock = useStore((s) => s.setStageClock);
  const correctPresentationSlideCount = useStore((s) => s.correctPresentationSlideCount);
  const outputStatuses = useStore((s) => s.outputStatuses);
  const [showOutputs, setShowOutputs] = useState(false);

  if (!library) return <div className="panel preview-panel">Loading…</div>;

  const selectedItem = activePlaylist?.items.find((i) => i.id === selection.itemId) ?? null;
  const previewSlide = selectedItem ? buildLiveSlide(selectedItem, selection.subIndex, library) : { kind: 'blank' as const };
  const isOnAir = !!selectedItem && selectedItem.id === liveItemId && selection.subIndex === liveSubIndex;

  return (
    <div className="panel preview-panel">
      <div className="preview-header">
        <h3>Preview</h3>
        <button onClick={() => setShowOutputs(true)}>Outputs…</button>
      </div>

      <div className="preview-frame">
        <SlideView
          slide={previewSlide}
          mode="full"
          onPresentationPageCount={(count) => {
            if (previewSlide.kind === 'presentation' && selectedItem?.presentationId) {
              const pres = library.presentations.find((p) => p.id === selectedItem.presentationId);
              if (pres && pres.slideCount !== count) correctPresentationSlideCount(pres.id, count);
            }
          }}
        />
      </div>

      <div className="live-controls">
        <button className="go-live" onClick={goLive} disabled={!selectedItem}>
          {isOnAir ? 'ON AIR' : 'GO LIVE'}
        </button>
        <button onClick={clearLive}>Clear</button>
      </div>

      <div className="stage-controls">
        <label>
          Stage message
          <input
            value={stageMessage}
            onChange={(e) => setStageMessage(e.target.value)}
            placeholder="e.g. 5 minutes to sermon"
          />
        </label>
        <label className="checkbox-row">
          <input type="checkbox" checked={stageClock} onChange={(e) => setStageClock(e.target.checked)} />
          Show clock on stage display
        </label>
      </div>

      <div className="output-status">
        {library.outputConfigs.filter((c) => c.enabled).map((c) => {
          const open = outputStatuses.find((s) => s.id === c.id)?.open;
          return (
            <span key={c.id} className={`status-chip ${open ? 'open' : 'closed'}`}>
              {c.name}: {open ? 'Live' : 'Closed'}
            </span>
          );
        })}
      </div>

      {showOutputs && <OutputsSettings onClose={() => setShowOutputs(false)} />}
    </div>
  );
}
