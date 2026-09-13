import { useState } from 'react';
import { useStore, useActivePlaylist } from '../store';
import { itemTypeMeta } from '../itemType';

function LoopIcon({ active }: { active: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--type-slides)' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

export function ServiceColumn() {
  const activePlaylist = useActivePlaylist();
  const selection = useStore((s) => s.selection);
  const select = useStore((s) => s.select);
  const removePlaylistItem = useStore((s) => s.removePlaylistItem);
  const reorderItem = useStore((s) => s.reorderItem);
  const liveItemId = useStore((s) => s.liveItemId);
  const goLive = useStore((s) => s.goLive);
  const undoStack = useStore((s) => s.scheduleUndoStack);
  const redoStack = useStore((s) => s.scheduleRedoStack);
  const undoSchedule = useStore((s) => s.undoSchedule);
  const redoSchedule = useStore((s) => s.redoSchedule);
  const togglePreServiceLoopItem = useStore((s) => s.togglePreServiceLoopItem);
  const preServiceLoop = useStore((s) => s.preServiceLoop);
  const startPreServiceLoop = useStore((s) => s.startPreServiceLoop);
  const stopPreServiceLoop = useStore((s) => s.stopPreServiceLoop);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<{ id: string; position: 'before' | 'after' } | null>(null);
  const [intervalInput, setIntervalInput] = useState(String(preServiceLoop.intervalSec));

  const items = activePlaylist?.items ?? [];
  const loopCount = items.filter((i) => i.loopSlide).length;

  return (
    <div className="service-column">
      <div className="column-header">
        <span className="mono column-title">SERVICE</span>
        <div className="service-header-right">
          <button className="row-icon-btn" onClick={undoSchedule} disabled={!undoStack.length} title="Undo (Ctrl+Z)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10h10a5 5 0 0 1 0 10h-2" /><polyline points="7 5 3 10 7 15" /></svg>
          </button>
          <button className="row-icon-btn" onClick={redoSchedule} disabled={!redoStack.length} title="Redo (Ctrl+Shift+Z)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10H11a5 5 0 0 0 0 10h2" /><polyline points="17 5 21 10 17 15" /></svg>
          </button>
          <span className="mono column-count">{items.length} ITEM{items.length === 1 ? '' : 'S'}</span>
        </div>
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
              onDoubleClick={() => {
                select(item.id, 0);
                goLive();
              }}
              title="Click to stage in Preview · double-click to go live immediately"
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
                className="row-icon-btn"
                onClick={(e) => { e.stopPropagation(); togglePreServiceLoopItem(item.id); }}
                title={item.loopSlide ? 'Remove from pre-service loop' : 'Add to pre-service loop'}
              >
                <LoopIcon active={!!item.loopSlide} />
              </button>
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

      {loopCount > 0 && (
        <div className="loop-panel">
          <div className="mono loop-panel-label">
            PRE-SERVICE LOOP · {loopCount} SLIDE{loopCount === 1 ? '' : 'S'}
          </div>
          <div className="loop-panel-controls">
            <input
              type="number"
              min={2}
              max={120}
              value={intervalInput}
              onChange={(e) => setIntervalInput(e.target.value)}
              disabled={preServiceLoop.active}
              className="loop-interval-input"
            />
            <span className="hint">sec</span>
            {preServiceLoop.active ? (
              <button className="loop-stop-btn" onClick={stopPreServiceLoop}>Stop loop</button>
            ) : (
              <button className="primary" onClick={() => startPreServiceLoop(Math.max(2, Number(intervalInput) || 8))}>
                Start loop
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
