import type { LiveSlide } from '@shared/types';
import { PdfPageCanvas } from './PdfPageCanvas';
import { NativeSlideView } from './NativeSlideView';

export type RenderMode = 'full' | 'stage' | 'stream';

interface Props {
  slide: LiveSlide;
  mode: RenderMode;
  /** Background used behind the 'stream' output when nothing is being shown (chroma-keyed out in OBS/vMix). */
  chromaKey?: string;
  /** Called when a presentation PDF reports its real page count, so the library record can be corrected. */
  onPresentationPageCount?: (count: number) => void;
  /** Independent layer toggles driven by "Clear Text" / "Clear Background" — both default true. */
  textVisible?: boolean;
  backgroundVisible?: boolean;
}

/** Renders a template's background (solid color, or a looping motion image/video behind lyrics/scripture text). */
function BackgroundLayer({ background }: { background: LiveSlide['background'] }) {
  if (!background || background.type === 'color') {
    return <div style={{ position: 'absolute', inset: 0, background: background?.value ?? '#000000' }} />;
  }
  if (background.type === 'video') {
    return (
      <video
        src={background.value}
        autoPlay
        loop
        muted
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      />
    );
  }
  return (
    <img
      src={background.value}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
    />
  );
}

/** Full-frame content (media loops, PowerPoint slides) — same on every output role that shows it at all. */
function FullFrameContent({ slide, onPresentationPageCount }: Pick<Props, 'slide' | 'onPresentationPageCount'>) {
  if (slide.kind === 'presentation' && slide.pdfPath) {
    return (
      <div style={{ width: '100%', height: '100%', background: '#000' }}>
        <PdfPageCanvas pdfPath={slide.pdfPath} pageNumber={slide.pageNumber ?? 1} onPageCount={onPresentationPageCount} />
      </div>
    );
  }
  if (slide.kind === 'presentation' && slide.nativeSlide) {
    return <NativeSlideView slide={slide.nativeSlide} />;
  }
  if (slide.kind === 'media' && slide.background) {
    return slide.background.type === 'video' ? (
      <video
        src={slide.background.value}
        autoPlay
        loop
        muted
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    ) : (
      <img src={slide.background.value} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    );
  }
  return null;
}

function TextSlide({
  slide,
  asLowerThird,
  textVisible = true,
  backgroundVisible = true,
}: {
  slide: LiveSlide;
  asLowerThird: boolean;
  textVisible?: boolean;
  backgroundVisible?: boolean;
}) {
  const t = slide.template;
  const fontFamily = t?.fontFamily ?? 'sans-serif';
  const color = t?.textColor ?? '#ffffff';
  const textAlign = t?.textAlign ?? 'center';

  // Template.fontSize is an absolute px value tuned for a real ~1920x1080 output window — fine for
  // the actual Program/Stage/Stream outputs (which really are that size), but this same component
  // also renders into small in-app monitors (Preview/Live panes, Songs/Themes previews, maybe
  // 200-400px tall). Rendering that px value directly there made three words fill the whole frame.
  // Convert to a container-query height unit against that same 1080 reference, matching the pattern
  // NativeSlideView already uses for PPTX text — on the real full-size outputs 100cqh == 1080px, so
  // this renders identically to before; on a small preview it scales down proportionally.
  const REFERENCE_HEIGHT = 1080;
  const fontSize = t?.fontSize ?? 56;
  const fontSizeCqh = (fontSize / REFERENCE_HEIGHT) * 100;

  if (asLowerThird) {
    return (
      <div style={{ width: '100%', height: '100%', position: 'relative', containerType: 'size' }}>
        {textVisible && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: '10%',
              padding: '1.5cqh 3cqw',
              background: 'rgba(0,0,0,0.55)',
              color,
              fontFamily,
              fontSize: `${Math.min(fontSizeCqh, (48 / REFERENCE_HEIGHT) * 100)}cqh`,
              textAlign,
              whiteSpace: 'pre-wrap',
            }}
          >
            {slide.text}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', containerType: 'size' }}>
      {backgroundVisible ? (
        <BackgroundLayer background={slide.background} />
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: '#000000' }} />
      )}
      {textVisible && (
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4cqh',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              color,
              fontFamily,
              fontSize: `${fontSizeCqh}cqh`,
              textAlign,
              whiteSpace: 'pre-wrap',
              lineHeight: 1.3,
              textShadow: '0 2px 12px rgba(0,0,0,0.6)',
              maxWidth: '100%',
            }}
          >
            {slide.text}
          </div>
        </div>
      )}
    </div>
  );
}

export function SlideView({
  slide,
  mode,
  chromaKey = '#00ff00',
  onPresentationPageCount,
  textVisible = true,
  backgroundVisible = true,
}: Props) {
  const isTextKind = slide.kind === 'song' || slide.kind === 'verse' || slide.kind === 'lowerThird';
  const isFullFrameKind = slide.kind === 'media' || slide.kind === 'presentation';

  if (mode === 'stream') {
    // The stream output is a dedicated overlay layer: text kinds render as a lower-third over a
    // chroma-key background (or true transparency); full-frame content is cut to directly on the
    // program feed instead, so this output stays keyed-out/blank for it.
    return (
      <div style={{ width: '100%', height: '100%', background: chromaKey }}>
        {isTextKind && <TextSlide slide={slide} asLowerThird textVisible={textVisible} />}
      </div>
    );
  }

  if (slide.kind === 'blank') {
    return <div style={{ width: '100%', height: '100%', background: '#000000' }} />;
  }

  if (isFullFrameKind) {
    // Media loops and presentation slides are the "background" layer — Clear Background blanks them.
    return (
      <div style={{ width: '100%', height: '100%', background: '#000000' }}>
        {backgroundVisible && <FullFrameContent slide={slide} onPresentationPageCount={onPresentationPageCount} />}
      </div>
    );
  }

  // song / verse / lowerThird on 'full' (program) or 'stage' (confidence monitor)
  return (
    <TextSlide
      slide={slide}
      asLowerThird={mode === 'full' && !!slide.template?.lowerThird}
      textVisible={textVisible}
      backgroundVisible={backgroundVisible}
    />
  );
}
