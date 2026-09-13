import type { NativeSlide } from '@shared/types';

/**
 * Renders a native-parsed PPTX slide (used when LibreOffice isn't available for pixel-accurate
 * pdf.js rendering). Font sizes are stored as a percentage of slide height and rendered with CSS
 * container-query units so they scale correctly whether shown as a small grid thumbnail or a
 * full-screen output — the parent frame just needs `container-type: size`.
 */
export function NativeSlideView({ slide }: { slide: NativeSlide }) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: slide.backgroundColor ?? '#ffffff',
        containerType: 'size',
      }}
    >
      {slide.backgroundImage && (
        <img
          src={slide.backgroundImage}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}
      {slide.textBoxes.map((box, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${box.xPct}%`,
            top: `${box.yPct}%`,
            width: `${box.wPct}%`,
            height: `${box.hPct}%`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            textAlign: box.align,
            overflow: 'hidden',
            fontFamily: 'sans-serif',
          }}
        >
          {box.paragraphs.map((p, pi) => (
            <div key={pi}>
              {p.runs.map((r, ri) => (
                <span
                  key={ri}
                  style={{
                    fontWeight: r.bold ? 700 : 400,
                    fontStyle: r.italic ? 'italic' : 'normal',
                    fontSize: `${r.fontSizePct ?? 4.5}cqh`,
                    color: r.color ?? '#000000',
                  }}
                >
                  {r.text}
                </span>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
