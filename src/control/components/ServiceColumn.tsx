import { useState } from 'react';
import { useStore, useActivePlaylist } from '../store';
import { itemTypeMeta } from '../itemType';

export function ServiceColumn() {
  const activePlaylist = useActivePlaylist();
  const selection = useStore((s) => s.selection);
  const select = useStore((s) => s.select);
  const removePlaylistItem = useStore((s) => s.removePlaylistItem);
  const reorderItem = useStore((s) => s.reorderItem);
  const liveItemId = useStore((s) => s.liveItemId);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<{ id: string; position: 'before' | 'after' } | null>(null);

  const items = activePlaylist?.items ?? [];

  return (
    <div className="service-column">
      <div className="column-header">
        <span className="mono column-title">SERVICE</span>
        <span className="mono column-count">{items.length} ITEM{items.length === 1 ? '' : 'S'}</span>
      </div>

      <div
        className="service-list"
        onDragOver={(e) => {
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
        {items.length === 0 && (
          <div className="empty-hint">Nothing scheduled yet. Add songs, scripture, media, or slides from the Library.</div>
        )}
        {items.map((item) => {
          const isStaged = item.id === selection.itemId;
          const isLive = item.id === liveItemId;
          const isDragOver = dragOver?.id === item.id && draggedId !== item.id;
          const meta = itemTypeMeta(item.type);
          return (
            <div
              key={item.id}
              className={
                'service-row' +
                (isStaged ? ' service-row-staged' : '') +
                (isDragOver ? ` drag-over-${dragOver!.position}` : '') +
                (draggedId === item.id ? ' dragging' : '')
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
              <span className="type-stripe" style={{ background: meta.color }} />
              <div className="service-row-body">
                <div className="service-row-title">{item.label}</div>
                <div className="mono service-row-meta">
                  {meta.label.toUpperCase()}
                  {isLive ? ' · LIVE' : isStaged ? ' · STAGED' : ''}
                </div>
              </div>
              {isLive && <span className="live-dot" title="On air" />}
              <button
                className="row-remove"
                onClick={(e) => {
                  e.stopPropagation();
                  removePlaylistItem(item.id);
                }}
                title="Remove from service"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <line x1="5" y1="5" x2="19" y2="19"></line>
                  <line x1="19" y1="5" x2="5" y2="19"></line>
                </svg>
              </button>
            </div>
          );
        })}
        {!!items.length && draggedId && (
          <div className={'end-dropzone' + (dragOver?.id === '__end__' ? ' active' : '')} />
        )}
      </div>
    </div>
  );
}
