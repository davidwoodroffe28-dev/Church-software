import { useStore, useActivePlaylist } from '../store';
import { buildLiveSlide } from '../slideBuilder';

export function StatusBar() {
  const library = useStore((s) => s.library);
  const playlist = useActivePlaylist();
  const liveItemId = useStore((s) => s.liveItemId);
  const liveSubIndex = useStore((s) => s.liveSubIndex);
  const outputStatuses = useStore((s) => s.outputStatuses);
  const streamPreviewOpen = useStore((s) => s.streamPreviewOpen);
  const toggleStreamPreview = useStore((s) => s.toggleStreamPreview);
  const hasStreamSource = !!library?.streamPreviewSource;

  const liveItem = playlist?.items.find((i) => i.id === liveItemId) ?? null;
  const liveSlide = liveItem && library ? buildLiveSlide(liveItem, liveSubIndex, library) : null;

  return (
    <div className="status-bar">
      <span className={'status-bar-live mono' + (liveItem ? ' status-bar-live-active' : '')}>
        {liveItem && <span className="live-dot" />}
        {liveItem && liveSlide?.label ? `${liveSlide.label} · On Air` : 'Nothing on air'}
      </span>
      <div className="status-bar-right mono">
        {library?.outputConfigs.filter((c) => c.enabled).map((c) => {
          const open = outputStatuses.find((s) => s.id === c.id)?.open;
          return (
            <span key={c.id} className={open ? 'status-open' : 'status-closed'}>
              {c.name.toUpperCase()} · {open ? 'OPEN' : 'CLOSED'}
            </span>
          );
        })}
        <button
          className={'status-stream-btn mono' + (streamPreviewOpen ? ' status-stream-btn-active' : '')}
          onClick={toggleStreamPreview}
          disabled={!hasStreamSource}
          title={hasStreamSource ? 'Show/hide the livestream preview' : 'Set a stream source first — Settings → Stream'}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="5" width="20" height="14" rx="2.5" />
            <path d="M8 21h8" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          Stream preview {streamPreviewOpen ? '▾' : '▸'}
        </button>
        <span className="status-hints">← → ADVANCE · SPACE GO LIVE · B BLACK · ESC CLEAR</span>
      </div>
    </div>
  );
}
