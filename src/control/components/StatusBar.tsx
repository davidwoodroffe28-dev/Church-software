import { useStore, useActivePlaylist } from '../store';
import { buildLiveSlide } from '../slideBuilder';

export function StatusBar() {
  const library = useStore((s) => s.library);
  const playlist = useActivePlaylist();
  const liveItemId = useStore((s) => s.liveItemId);
  const liveSubIndex = useStore((s) => s.liveSubIndex);
  const outputStatuses = useStore((s) => s.outputStatuses);

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
        <span className="status-hints">← → ADVANCE · SPACE GO LIVE · B BLACK · ESC CLEAR</span>
      </div>
    </div>
  );
}
