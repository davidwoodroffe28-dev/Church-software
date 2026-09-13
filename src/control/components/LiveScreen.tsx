import { useEffect } from 'react';
import { useStore, useActivePlaylist } from '../store';
import { LibraryColumn } from './LibraryColumn';
import { ServiceColumn } from './ServiceColumn';
import { SlidePane } from './SlidePane';

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

export function LiveScreen() {
  const playlist = useActivePlaylist();
  const selection = useStore((s) => s.selection);
  const select = useStore((s) => s.select);
  const stepSubSlide = useStore((s) => s.stepSubSlide);
  const goLive = useStore((s) => s.goLive);

  const liveItemId = useStore((s) => s.liveItemId);
  const liveSubIndex = useStore((s) => s.liveSubIndex);
  const liveTextVisible = useStore((s) => s.liveTextVisible);
  const liveBackgroundVisible = useStore((s) => s.liveBackgroundVisible);
  const stepLive = useStore((s) => s.stepLive);
  const setLiveSubIndex = useStore((s) => s.setLiveSubIndex);
  const clearLive = useStore((s) => s.clearLive);
  const clearText = useStore((s) => s.clearText);
  const restoreText = useStore((s) => s.restoreText);
  const toggleBlack = useStore((s) => s.toggleBlack);

  const previewItem = playlist?.items.find((i) => i.id === selection.itemId) ?? null;
  const liveItem = playlist?.items.find((i) => i.id === liveItemId) ?? null;
  const isBlack = !liveTextVisible && !liveBackgroundVisible;
  const isTextCleared = !liveTextVisible;

  // DESIGN-SPEC.md §6: ← → advance live, B black, Esc clear — suppressed while typing.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        stepLive(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        stepLive(-1);
      } else if (e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleBlack();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (liveTextVisible) clearText();
        else restoreText();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [stepLive, toggleBlack, clearText, restoreText, liveTextVisible]);

  return (
    <div className="live-screen">
      <LibraryColumn />

      <div className="preview-live-split">
        <SlidePane
          kind="preview"
          item={previewItem}
          activeSubIndex={selection.subIndex}
          onSelectSub={(idx) => previewItem && select(previewItem.id, idx)}
          onSelectSubDouble={(idx) => {
            if (!previewItem) return;
            select(previewItem.id, idx);
            goLive();
          }}
          onStep={stepSubSlide}
          actions={
            <button className="send-to-live" onClick={goLive} disabled={!previewItem}>
              Send to Live →
            </button>
          }
        />

        <SlidePane
          kind="live"
          item={liveItem}
          activeSubIndex={liveSubIndex}
          onSelectSub={setLiveSubIndex}
          onStep={stepLive}
          textVisible={liveTextVisible}
          backgroundVisible={liveBackgroundVisible}
          headerExtra={
            liveItemId ? (
              <button className="take-off-air" onClick={clearLive}>
                Take off air
              </button>
            ) : undefined
          }
          actions={
            <>
              <button className={'toggle-btn' + (isBlack ? ' toggle-btn-active' : '')} onClick={toggleBlack} disabled={!liveItemId}>
                Black
              </button>
              <button
                className={'toggle-btn' + (isTextCleared ? ' toggle-btn-active' : '')}
                onClick={() => (liveTextVisible ? clearText() : restoreText())}
                disabled={!liveItemId}
              >
                Clear
              </button>
              <button className="toggle-btn" disabled title="Logo output — coming soon">
                Logo
              </button>
            </>
          }
        />
      </div>

      <ServiceColumn />
    </div>
  );
}
