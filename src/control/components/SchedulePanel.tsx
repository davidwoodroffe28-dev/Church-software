import { useState } from 'react';
import type { PlaylistItem } from '@shared/types';
import { useStore, useActivePlaylist } from '../store';
import { LibraryPanel } from './LibraryPanel';

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

export function SchedulePanel() {
  const activePlaylist = useActivePlaylist();
  const selection = useStore((s) => s.selection);
  const select = useStore((s) => s.select);
  const removePlaylistItem = useStore((s) => s.removePlaylistItem);
  const reorderItem = useStore((s) => s.reorderItem);
  const liveItemId = useStore((s) => s.liveItemId);
  const [mode, setMode] = useState<'schedule' | 'library'>('schedule');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<{ id: string; position: 'before' | 'after' } | null>(null);

  return (
    <div className="panel schedule-panel">
      <div className="tab-bar">
        <button className={mode === 'schedule' ? 'active' : ''} onClick={() => setMode('schedule')}>
          Schedule
        </button>
        <button className={mode === 'library' ? 'active' : ''} onClick={() => setMode('library')}>
          + Add Items
        </button>
      </div>

      {mode === 'library' ? (
        <LibraryPanel embedded />
      ) : (
        <>
          <h3>{activePlaylist?.name ?? 'Order of Service'}</h3>
          <ul
            className="schedule-list"
            onDragOver={(e) => {
              // Bare container area (below the last item): dropping here appends to the end.
              e.preventDefault();
              setDragOver({ id: '__end__', position: 'after' });
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (draggedId) reorderItem(draggedId, null);
              setDraggedId(null);
              setDragOver(null);
            }}
          >
            {activePlaylist?.items.map((item) => {
              const isSelected = item.id === selection.itemId;
              const isLive = item.id === liveItemId;
              const isDragOver = dragOver?.id === item.id && draggedId !== item.id;
              return (
                <li
                  key={item.id}
                  className={
                    (isSelected ? 'selected ' : '') +
                    (isDragOver ? `drag-over-${dragOver!.position} ` : '') +
                    (draggedId === item.id ? 'dragging' : '')
                  }
                  draggable
                  onDragStart={() => setDraggedId(item.id)}
                  onDragEnd={() => {
                    setDraggedId(null);
                    setDragOver(null);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    const position = e.clientY - rect.top > rect.height / 2 ? 'after' : 'before';
                    if (dragOver?.id !== item.id || dragOver.position !== position) {
                      setDragOver({ id: item.id, position });
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (draggedId && draggedId !== item.id) {
                      reorderItem(draggedId, item.id, dragOver?.position ?? 'before');
                    }
                    setDraggedId(null);
                    setDragOver(null);
                  }}
                  onClick={() => select(item.id, 0)}
                >
                  <span className="drag-handle" title="Drag to reorder">⠿</span>
                  {isLive && <span className="live-dot" title="On air" />}
                  <span className="item-icon">{itemIcon(item.type)}</span>
                  <span className="item-title">{item.label}</span>
                  <button
                    className="remove-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      removePlaylistItem(item.id);
                    }}
                    title="Remove from schedule"
                  >
                    ✕
                  </button>
                </li>
              );
            })}
            {activePlaylist?.items.length === 0 && (
              <li className="empty-hint">
                Nothing scheduled yet. Click <strong>+ Add Items</strong> above to bring in songs, media,
                Bible verses, or slides.
              </li>
            )}
            {!!activePlaylist?.items.length && draggedId && (
              <li className={'end-dropzone' + (dragOver?.id === '__end__' ? ' active' : '')} />
            )}
          </ul>
        </>
      )}
    </div>
  );
}
