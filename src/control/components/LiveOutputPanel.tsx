import { useState } from 'react';
import { useStore, useActivePlaylist } from '../store';
import { buildLiveSlide } from '../slideBuilder';
import { SlideView } from '../../shared-ui/SlideView';
import { OutputsSettings } from './OutputsSettings';

export function LiveOutputPanel() {
  const library = useStore((s) => s.library);
  const activePlaylist = useActivePlaylist();
  const selection = useStore((s) => s.selection);
  const liveItemId = useStore((s) => s.liveItemId);
  const liveSubIndex = useStore((s) => s.liveSubIndex);
  const liveTextVisible = useStore((s) => s.liveTextVisible);
  const liveBackgroundVisible = useStore((s) => s.liveBackgroundVisible);
  const goLive = useStore((s) => s.goLive);
  const clearLive = useStore((s) => s.clearLive);
  const clearText = useStore((s) => s.clearText);
  const clearBackground = useStore((s) => s.clearBackground);
  const restoreText = useStore((s) => s.restoreText);
  const restoreBackground = useStore((s) => s.restoreBackground);
  const stageMessage = useStore((s) => s.stageMessage);
  const setStageMessage = useStore((s) => s.setStageMessage);
  const stageClock = useStore((s) => s.stageClock);
  const setStageClock = useStore((s) => s.setStageClock);
  const outputStatuses = useStore((s) => s.outputStatuses);
  const [showOutputs, setShowOutputs] = useState(false);

  if (!library) return <div className="panel live-panel">Loading…</div>;

  const liveItem = activePlaylist?.items.find((i) => i.id === liveItemId) ?? null;
  const liveSlide = liveItem ? buildLiveSlide(liveItem, liveSubIndex, library) : { kind: 'blank' as const };
  const selectedItem = activePlaylist?.items.find((i) => i.id === selection.itemId) ?? null;
  const isOnAir = !!selectedItem && selectedItem.id === liveItemId && selection.subIndex === liveSubIndex;

  return (
    <div className="panel live-panel">
      <div className="preview-header">
        <h3>Live Output</h3>
        <button onClick={() => setShowOutputs(true)}>Outputs…</button>
      </div>

      <div className="on-air-frame">
        <SlideView slide={liveSlide} mode="full" textVisible={liveTextVisible} backgroundVisible={liveBackgroundVisible} />
        {liveItemId && <span className="on-air-badge">ON AIR</span>}
      </div>

      <div className="live-controls">
        <button className="go-live" onClick={goLive} disabled={!selectedItem}>
          {isOnAir ? 'ON AIR' : 'GO LIVE'}
        </button>
      </div>

      <div className="clear-controls">
        <button onClick={liveTextVisible ? clearText : restoreText} disabled={!liveItemId}>
          {liveTextVisible ? 'Clear Text' : 'Show Text'}
        </button>
        <button onClick={liveBackgroundVisible ? clearBackground : restoreBackground} disabled={!liveItemId}>
          {liveBackgroundVisible ? 'Clear Background' : 'Show Background'}
        </button>
        <button className="clear-all" onClick={clearLive} disabled={!liveItemId}>
          Clear All
        </button>
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
