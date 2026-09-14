import { useState } from 'react';
import { STREAM_EMBED_PORT } from '@shared/constants';
import { useStore } from '../store';
import { toYouTubeEmbedSrc } from '../youtubeEmbed';

/** Floating panel so whoever's running slides can see the actual livestream — lower thirds and
 *  all — without alt-tabbing away from the app. Toggled from the status bar; rendered at the App
 *  level (not inside LiveScreen) so it stays up across tab switches. Never touches program output
 *  — purely a monitor, same spirit as the Live pane's on-air preview but for the outside view.
 *  Starts as a small corner card; the expand button grows it to a large centered preview for
 *  actually checking lower-third legibility, not just confirming the stream is live. */
export function StreamPreview() {
  const open = useStore((s) => s.streamPreviewOpen);
  const close = useStore((s) => s.toggleStreamPreview);
  const source = useStore((s) => s.library?.streamPreviewSource ?? null);
  const [muted, setMuted] = useState(true);
  const [expanded, setExpanded] = useState(false);

  if (!open) return null;

  const embedSrc = source ? toYouTubeEmbedSrc(source) : null;
  const mutedSrc = embedSrc ? embedSrc.replace(/mute=\d/, `mute=${muted ? 1 : 0}`) : null;
  // Routed through a local wrapper page (see electron/streamEmbedServer.ts) rather than straight to
  // YouTube — this window loads via file:// in production, and YouTube's player refuses to embed
  // for a file:// (null-origin) parent.
  const iframeSrc = mutedSrc ? `http://localhost:${STREAM_EMBED_PORT}/?src=${encodeURIComponent(mutedSrc)}` : null;

  return (
    <>
      {expanded && <div className="stream-preview-backdrop" onClick={() => setExpanded(false)} />}
      <div className={'stream-preview' + (expanded ? ' stream-preview-expanded' : '')}>
        <div className="stream-preview-header">
          <span className="mono stream-preview-title">Stream preview</span>
          <div className="stream-preview-actions">
            {mutedSrc && (
              <button className="row-icon-btn" onClick={() => setMuted((m) => !m)} title={muted ? 'Unmute' : 'Mute'}>
                {muted ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="4 9 8 9 12 5 12 19 8 15 4 15 4 9" />
                    <line x1="16" y1="9" x2="21" y2="14" />
                    <line x1="21" y1="9" x2="16" y2="14" />
                  </svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="4 9 8 9 12 5 12 19 8 15 4 15 4 9" />
                    <path d="M16 8a5 5 0 0 1 0 8" />
                    <path d="M18.5 5.5a9 9 0 0 1 0 13" />
                  </svg>
                )}
              </button>
            )}
            {mutedSrc && (
              <button className="row-icon-btn" onClick={() => setExpanded((e) => !e)} title={expanded ? 'Shrink' : 'Expand to full preview'}>
                {expanded ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="4 14 10 14 10 20" />
                    <polyline points="20 10 14 10 14 4" />
                    <line x1="14" y1="10" x2="21" y2="3" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 3 21 3 21 9" />
                    <polyline points="9 21 3 21 3 15" />
                    <line x1="21" y1="3" x2="14" y2="10" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </svg>
                )}
              </button>
            )}
            <button
              className="row-icon-btn"
              onClick={() => {
                setExpanded(false);
                close();
              }}
              title="Close"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="5" y1="5" x2="19" y2="19" />
                <line x1="19" y1="5" x2="5" y2="19" />
              </svg>
            </button>
          </div>
        </div>
        {mutedSrc ? (
          <iframe
            className="stream-preview-frame"
            src={iframeSrc ?? undefined}
            title="Live stream preview"
            allow="autoplay; encrypted-media"
          />
        ) : (
          <div className="stream-preview-empty">
            {source
              ? "Couldn't read that as a YouTube video or channel link."
              : 'No stream source set yet.'}{' '}
            Set one in Settings → Stream.
          </div>
        )}
      </div>
    </>
  );
}
