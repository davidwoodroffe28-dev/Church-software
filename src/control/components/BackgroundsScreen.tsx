import { useState } from 'react';
import type { MediaItem } from '@shared/types';
import { useStore, computeCurrentAndNext } from '../store';
import { SlideView } from '../../shared-ui/SlideView';
import { SafeVideo } from '../../shared-ui/SafeVideo';

type Filter = 'all' | 'image' | 'video';

/** Applying a background here is independent of the service entirely — it's not a playlist item,
 *  it doesn't need a Theme built first, and it persists underneath whatever song/verse/lower-third
 *  is actually live until cleared or replaced. See slideBuilder.applyBackgroundOverride. */
export function BackgroundsScreen() {
  const library = useStore((s) => s.library);
  const importMediaFiles = useStore((s) => s.importMediaFiles);
  const backgroundOverride = useStore((s) => s.backgroundOverride);
  const setBackgroundOverride = useStore((s) => s.setBackgroundOverride);
  const clearBackgroundOverride = useStore((s) => s.clearBackgroundOverride);
  // Re-render when live state changes so the "what the room sees" preview stays accurate.
  const liveItemId = useStore((s) => s.liveItemId);
  const liveSubIndex = useStore((s) => s.liveSubIndex);
  const liveTextVisible = useStore((s) => s.liveTextVisible);
  const liveBackgroundVisible = useStore((s) => s.liveBackgroundVisible);
  const countdown = useStore((s) => s.countdown);

  const [filter, setFilter] = useState<Filter>('all');

  if (!library) return null;

  const media = library.media.filter((m) => filter === 'all' || m.type === filter);
  const isApplied = (m: MediaItem) => backgroundOverride?.value === m.filePath;

  function apply(m: MediaItem) {
    setBackgroundOverride({ type: m.type, value: m.filePath });
  }

  const { current } = computeCurrentAndNext(useStore.getState);

  return (
    <div className="media-screen">
      <div className="media-main-column">
        <div className="column-header">
          <span className="mono column-title">BACKGROUNDS</span>
          <button onClick={importMediaFiles}>+ Add media…</button>
        </div>
        <div className="hint">
          Click a background to apply it live, underneath whatever song, scripture, or lower-third is currently
          showing — it stays applied as you move through the service, no need to add it to the schedule.
        </div>

        <div className="filter-pills">
          <button className={'filter-pill' + (filter === 'all' ? ' filter-pill-active' : '')} onClick={() => setFilter('all')}>ALL</button>
          <button className={'filter-pill' + (filter === 'image' ? ' filter-pill-active' : '')} onClick={() => setFilter('image')}>IMAGES</button>
          <button className={'filter-pill' + (filter === 'video' ? ' filter-pill-active' : '')} onClick={() => setFilter('video')}>VIDEOS</button>
        </div>

        {media.length === 0 ? (
          <div className="empty-hint">No media yet. Click + Add media to import images or video loops.</div>
        ) : (
          <div className="media-grid">
            {media.map((m) => (
              <button
                key={m.id}
                className={'media-tile' + (isApplied(m) ? ' media-tile-active' : '')}
                onClick={() => apply(m)}
                title="Apply as the live background"
              >
                <div className="media-tile-frame">
                  {m.type === 'image' ? (
                    <img src={m.filePath} alt="" />
                  ) : (
                    <SafeVideo src={m.filePath} muted preload="metadata" />
                  )}
                  {m.type === 'video' && (
                    <span className="media-tile-play">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                    </span>
                  )}
                  {isApplied(m) && <span className="media-tile-applied mono">APPLIED</span>}
                </div>
                <span className="media-tile-label">{m.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="media-detail-column">
        <div className="column-header">
          <span className="mono column-title">LIVE NOW</span>
        </div>
        <div className="slide-monitor songs-monitor">
          <SlideView slide={current} mode="full" textVisible={liveTextVisible} backgroundVisible={liveBackgroundVisible} />
        </div>

        <div className="column-header" style={{ marginTop: 'var(--sp-4)' }}>
          <span className="mono column-title">CURRENT BACKGROUND</span>
        </div>
        {backgroundOverride ? (
          <>
            <div className="hint">
              Applied to every song, scripture reading, and lower-third until cleared — full-frame media and
              PowerPoint slides are unaffected, they're already their own full picture.
            </div>
            <button onClick={clearBackgroundOverride}>Clear background</button>
          </>
        ) : (
          <div className="hint">No background applied — each item is using its own theme's background.</div>
        )}
      </div>
    </div>
  );
}
