import { forwardRef, useState, type VideoHTMLAttributes } from 'react';

const ERROR_CODES: Record<number, string> = {
  1: 'aborted',
  2: 'network error',
  3: 'decode error — the file may be corrupt or use an unsupported codec',
  4: 'format/codec not supported by this build of Electron',
};

/** A <video> that surfaces a real error message instead of silently rendering blank/black when a
 *  file fails to decode — a plain <video> gives no visual signal at all when e.g. its codec isn't
 *  supported, which is indistinguishable from "just hasn't loaded a frame yet." */
export const SafeVideo = forwardRef<HTMLVideoElement, VideoHTMLAttributes<HTMLVideoElement>>(function SafeVideo(
  { style, onError, onLoadedMetadata, ...props },
  ref
) {
  const [error, setError] = useState<string | null>(null);

  if (error) {
    return (
      <div
        style={{
          ...style,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1a0e0e',
          color: '#ff8a8a',
          fontSize: 11,
          lineHeight: 1.4,
          textAlign: 'center',
          padding: 8,
          boxSizing: 'border-box',
        }}
      >
        Video error: {error}
      </div>
    );
  }

  return (
    <video
      {...props}
      ref={ref}
      style={style}
      onError={(e) => {
        const code = e.currentTarget.error?.code;
        // eslint-disable-next-line no-console
        console.error('[SafeVideo] decode failed', {
          src: e.currentTarget.currentSrc || e.currentTarget.src,
          code,
          message: e.currentTarget.error?.message,
        });
        setError(ERROR_CODES[code ?? 0] ?? `unknown (code ${code ?? '?'})`);
        onError?.(e);
      }}
      onLoadedMetadata={(e) => {
        // preload="metadata" (used for grid thumbnails) loads duration/dimensions but doesn't
        // reliably paint a visible frame without a nudge — a real, separate failure mode from a
        // decode error: the video is fine, it's just showing nothing until something seeks it.
        const el = e.currentTarget;
        if (el.currentTime === 0 && !el.autoplay) {
          try {
            el.currentTime = Math.min(0.1, el.duration || 0.1);
          } catch {
            // Some formats reject an early seek before enough data is buffered — harmless to skip.
          }
        }
        onLoadedMetadata?.(e);
      }}
    />
  );
});
