import { useRef, useState } from 'react';
import type { MediaItem } from '@shared/types';
import { useStore } from '../store';
import { SafeVideo } from '../../shared-ui/SafeVideo';

type Filter = 'all' | 'image' | 'video';

export function MediaScreen() {
  const library = useStore((s) => s.library);
  const importMediaFiles = useStore((s) => s.importMediaFiles);
  const deleteMedia = useStore((s) => s.deleteMedia);
  const addPlaylistItem = useStore((s) => s.addPlaylistItem);

  const [filter, setFilter] = useState<Filter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  if (!library) return null;

  const media = library.media.filter((m) => filter === 'all' || m.type === filter);
  const selected = library.media.find((m) => m.id === selectedId) ?? null;

  function select(item: MediaItem) {
    setSelectedId(item.id);
    setPlaying(false);
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  }

  return (
    <div className="media-screen">
      <div className="media-main-column">
        <div className="column-header">
          <span className="mono column-title">MEDIA</span>
          <button onClick={importMediaFiles}>+ Add media…</button>
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
                className={'media-tile' + (m.id === selectedId ? ' media-tile-active' : '')}
                onClick={() => select(m)}
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
                </div>
                <span className="media-tile-label">{m.name}</span>
              </button>
            ))}
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
              {selected.type === 'image' ? (
                <img src={selected.filePath} alt="" />
              ) : (
                <SafeVideo ref={videoRef} src={selected.filePath} loop />
              )}
            </div>
            {selected.type === 'video' && (
              <button onClick={togglePlay}>{playing ? 'Pause preview' : 'Play preview'}</button>
            )}
            <div className="media-detail-name">{selected.name}</div>
            <div className="mono media-detail-meta">{selected.type.toUpperCase()}</div>
            <button className="primary" onClick={() => addPlaylistItem({ type: 'media', refId: selected.id, label: selected.name })}>
              Add to service
            </button>
            <button
              onClick={() => {
                deleteMedia(selected.id);
                setSelectedId(null);
              }}
            >
              Delete
            </button>
          </>
        ) : (
          <div className="empty-hint">Select an item to preview it here.</div>
        )}
      </div>
    </div>
  );
}
