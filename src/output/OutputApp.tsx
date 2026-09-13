import { useEffect, useState } from 'react';
import type { OutputRole, ProgramState } from '@shared/types';
import { SlideView } from '../shared-ui/SlideView';

function useQueryParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    role: (params.get('role') as OutputRole) || 'program',
    outputId: params.get('outputId') ?? '',
    chroma: params.get('chroma') || '#00ff00',
  };
}

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return <span>{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>;
}

export function OutputApp() {
  const { role, chroma } = useQueryParams();
  const [state, setState] = useState<ProgramState>({ current: { kind: 'blank' } });

  useEffect(() => {
    return window.outputApi.onProgramState(setState);
  }, []);

  const mode = role === 'program' ? 'full' : role === 'stage' ? 'stage' : 'stream';

  if (role === 'stage') {
    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          background: '#000',
          color: '#eee',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ flex: 1, minHeight: 0 }}>
          <SlideView
            slide={state.current}
            mode="stage"
            textVisible={state.textVisible}
            backgroundVisible={state.backgroundVisible}
          />
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.75em 1.5em',
            borderTop: '1px solid #333',
            fontSize: 22,
            gap: '2em',
          }}
        >
          <div style={{ opacity: 0.85 }}>
            {state.next ? <>NEXT: {state.next.label ?? state.next.text ?? '—'}</> : 'NEXT: —'}
          </div>
          {state.stageMessage && <div style={{ color: '#ffd76a', fontWeight: 'bold' }}>{state.stageMessage}</div>}
          {state.stageClock && <Clock />}
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <SlideView
        slide={state.current}
        mode={mode}
        chromaKey={chroma}
        textVisible={state.textVisible}
        backgroundVisible={state.backgroundVisible}
      />
    </div>
  );
}
