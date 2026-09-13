import type { PlaylistItem } from '@shared/types';
import { useStore } from '../store';
import { getSubSlideCount, buildLiveSlide } from '../slideBuilder';

function itemIcon(type: PlaylistItem['type']): string {
  switch (type) {
    case 'song':
      return '🎵';
    case 'verse':
      return '📖';
    case 'media':
      return '🖼️';
    case 'lowerThird':
      return '🔤';
    case 'presentation':
      return '📽️';
  }
}

export function PlaylistPanel() {
  const library = useStore((s) => s.library);
  const activePlaylist = useStore((s) => s.activePlaylist)();
  const selection = useStore((s) => s.selection);
  const select = useStore((s) => s.select);
  const stepSubSlide = useStore((s) => s.stepSubSlide);
  const moveItem = useStore((s) => s.moveItem);
  const removePlaylistItem = useStore((s) => s.removePlaylistItem);
  const liveItemId = useStore((s) => s.liveItemId);
  const liveSubIndex = useStore((s) => s.liveSubIndex);

  if (!library || !activePlaylist) return <div className="panel playlist-panel">Loading…</div>;

  const selectedItem = activePlaylist.items.find((i) => i.id === selection.itemId) ?? null;
  const subCount = selectedItem ? getSubSlideCount(selectedItem, library) : 0;

  return (
    <div className="panel playlist-panel">
      <h3>{activePlaylist.name}</h3>
      <ul className="playlist-list">
        {activePlaylist.items.map((item, idx) => {
          const isSelected = item.id === selection.itemId;
          const isLive = item.id === liveItemId;
          return (
            <li key={item.id} className={isSelected ? 'selected' : ''}>
              <div className="playlist-row" onClick={() => select(item.id, 0)}>
                {isLive && <span className="live-dot" title="On air" />}
                <span className="item-icon">{itemIcon(item.type)}</span>
                <span className="item-title">{item.label}</span>
                <div className="item-actions">
                  <button onClick={(e) => { e.stopPropagation(); moveItem(item.id, -1); }} disabled={idx === 0}>↑</button>
                  <button onClick={(e) => { e.stopPropagation(); moveItem(item.id, 1); }} disabled={idx === activePlaylist.items.length - 1}>↓</button>
                  <button onClick={(e) => { e.stopPropagation(); removePlaylistItem(item.id); }}>✕</button>
                </div>
              </div>
              {isSelected && subCount > 1 && (
                <div className="sub-slide-nav">
                  {Array.from({ length: subCount }).map((_, subIdx) => {
                    const slide = buildLiveSlide(item, subIdx, library);
                    const isLiveSub = isLive && liveSubIndex === subIdx;
                    return (
                      <button
                        key={subIdx}
                        className={
                          (selection.subIndex === subIdx ? 'active ' : '') + (isLiveSub ? 'on-air' : '')
                        }
                        onClick={(e) => { e.stopPropagation(); select(item.id, subIdx); }}
                      >
                        {slide.label?.split('—').pop()?.trim() || `Slide ${subIdx + 1}`}
                      </button>
                    );
                  })}
                </div>
              )}
            </li>
          );
        })}
        {activePlaylist.items.length === 0 && <li className="empty-hint">Add songs, media, verses, or slides from the left to build your order of service.</li>}
      </ul>
      {selectedItem && subCount > 1 && (
        <div className="sub-slide-step-buttons">
          <button onClick={() => stepSubSlide(-1)}>◀ Prev</button>
          <button onClick={() => stepSubSlide(1)}>Next ▶</button>
        </div>
      )}
    </div>
  );
}
