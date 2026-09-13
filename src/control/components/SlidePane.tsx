import type { ReactNode } from 'react';
import type { PlaylistItem } from '@shared/types';
import { useStore } from '../store';
import { buildLiveSlide, getSubSlideCount } from '../slideBuilder';
import { SlideView } from '../../shared-ui/SlideView';

interface Props {
  kind: 'preview' | 'live';
  item: PlaylistItem | null;
  activeSubIndex: number;
  onSelectSub: (idx: number) => void;
  /** Double-click a row to jump straight there without the separate "Send to Live" step — only
   *  meaningful on the Preview pane (Live's rows are already on air). */
  onSelectSubDouble?: (idx: number) => void;
  onStep: (direction: -1 | 1) => void;
  actions: ReactNode;
  headerExtra?: ReactNode;
  textVisible?: boolean;
  backgroundVisible?: boolean;
}

/** Preview and Live are the same vertical stack — header, slide list, transport, monitor — so both
 *  panes render from this one component. Keeping the pairing visually identical is what makes it
 *  readable at a glance (DESIGN-SPEC.md §5). */
export function SlidePane({
  kind,
  item,
  activeSubIndex,
  onSelectSub,
  onSelectSubDouble,
  onStep,
  actions,
  headerExtra,
  textVisible = true,
  backgroundVisible = true,
}: Props) {
  const library = useStore((s) => s.library);
  if (!library) return null;

  const subCount = item ? getSubSlideCount(item, library) : 0;
  const activeSlide = item ? buildLiveSlide(item, activeSubIndex, library) : { kind: 'blank' as const };
  const rows = item
    ? Array.from({ length: subCount }, (_, idx) => ({ idx, slide: buildLiveSlide(item, idx, library) }))
    : [];

  const paneLabel = kind === 'preview' ? 'PREVIEW' : 'LIVE';
  const countLabel = item ? `${subCount} SLIDE${subCount === 1 ? '' : 'S'}` : 'NOTHING STAGED';

  return (
    <div className={'slide-pane slide-pane-' + kind}>
      <div className="slide-pane-header">
        <span className={'mono slide-pane-label slide-pane-label-' + kind}>
          {paneLabel} · {countLabel}
        </span>
        {headerExtra}
      </div>
      <div className="slide-pane-title">{item?.label ?? '—'}</div>

      <div className="slide-row-list">
        {rows.length === 0 && <div className="slide-row-empty">Nothing staged yet.</div>}
        {rows.map(({ idx, slide }) => {
          const isActive = idx === activeSubIndex;
          const verseLabel = slide.label?.split('—').pop()?.trim() || `Slide ${idx + 1}`;
          return (
            <button
              key={idx}
              className={'slide-row' + (isActive ? ` slide-row-active-${kind}` : '')}
              onClick={() => onSelectSub(idx)}
              onDoubleClick={onSelectSubDouble ? () => onSelectSubDouble(idx) : undefined}
              title={onSelectSubDouble ? 'Click to stage · double-click to go live immediately' : undefined}
            >
              <span className="mono slide-row-tag">
                {isActive && kind === 'live' && <span className="live-blip" />}
                {verseLabel.toUpperCase()}
              </span>
              <span className="slide-row-text">{slide.text ?? item?.label}</span>
            </button>
          );
        })}
      </div>

      <div className="slide-pane-transport">
        <button className="transport-btn" onClick={() => onStep(-1)} disabled={!item} title="Previous">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <button className="transport-btn" onClick={() => onStep(1)} disabled={!item} title="Next">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
        {actions}
      </div>

      <div className="slide-monitor">
        <SlideView slide={activeSlide} mode="full" textVisible={textVisible} backgroundVisible={backgroundVisible} />
      </div>
    </div>
  );
}
