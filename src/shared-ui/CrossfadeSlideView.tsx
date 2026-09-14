import { useEffect, useRef, useState } from 'react';
import type { LiveSlide } from '@shared/types';
import { SlideView, type RenderMode } from './SlideView';

const FADE_MS = 350;
// Full-frame media/PowerPoint already carry their own motion (and video audio) — briefly overlapping
// two of them would double up playback and decoding, so those kinds cut instantly instead of fading.
const NO_FADE_KINDS = new Set(['media', 'presentation']);

interface Props {
  slide: LiveSlide;
  mode: RenderMode;
  chromaKey?: string;
  textVisible?: boolean;
  backgroundVisible?: boolean;
}

interface Layer {
  id: number;
  slide: LiveSlide;
}

/** Drop-in replacement for SlideView on audience/stage-facing outputs: crossfades between slides
 *  instead of the hard cut a plain prop change gives you, matching the visual polish operators
 *  expect from ProPresenter/EasyWorship. Only for actual outputs — in-app monitors (SlidePane,
 *  BackgroundsScreen preview) should keep updating instantly since that's operator feedback, not
 *  something the room sees. */
export function CrossfadeSlideView({ slide, mode, chromaKey, textVisible, backgroundVisible }: Props) {
  const [base, setBase] = useState<Layer>(() => ({ id: 0, slide }));
  const [incoming, setIncoming] = useState<Layer | null>(null);
  const [entered, setEntered] = useState(false);
  const nextId = useRef(1);
  const keyRef = useRef(JSON.stringify(slide));

  useEffect(() => {
    const key = JSON.stringify(slide);
    if (key === keyRef.current) return;
    keyRef.current = key;

    if (NO_FADE_KINDS.has(base.slide.kind) || NO_FADE_KINDS.has(slide.kind)) {
      setBase({ id: nextId.current++, slide });
      setIncoming(null);
      setEntered(false);
      return;
    }
    setIncoming({ id: nextId.current++, slide });
    setEntered(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide]);

  useEffect(() => {
    if (!incoming) return;
    const raf = requestAnimationFrame(() => setEntered(true));
    const timeout = setTimeout(() => {
      setBase(incoming);
      setIncoming(null);
      setEntered(false);
    }, FADE_MS + 30);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timeout);
    };
  }, [incoming]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div style={{ position: 'absolute', inset: 0 }}>
        <SlideView slide={base.slide} mode={mode} chromaKey={chromaKey} textVisible={textVisible} backgroundVisible={backgroundVisible} />
      </div>
      {incoming && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: entered ? 1 : 0,
            transition: `opacity ${FADE_MS}ms ease`,
          }}
        >
          <SlideView slide={incoming.slide} mode={mode} chromaKey={chromaKey} textVisible={textVisible} backgroundVisible={backgroundVisible} />
        </div>
      )}
    </div>
  );
}
