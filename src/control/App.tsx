import { useEffect, useState } from 'react';
import { useStore } from './store';
import { TitleBar } from './components/TitleBar';
import { TabRow, type ScreenTab } from './components/TabRow';
import { StatusBar } from './components/StatusBar';
import { LiveScreen } from './components/LiveScreen';
import { ComingSoon } from './components/ComingSoon';

const SCREEN_LABELS: Record<Exclude<ScreenTab, 'live'>, string> = {
  home: 'Home',
  songs: 'Songs',
  bible: 'Bible',
  media: 'Media',
  themes: 'Themes',
  stage: 'Stage',
  settings: 'Settings',
};

export function App() {
  const loading = useStore((s) => s.loading);
  const load = useStore((s) => s.load);
  const [tab, setTab] = useState<ScreenTab>('live');

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <div className="app-loading">Loading library…</div>;
  }

  return (
    <div className="app-shell">
      <TitleBar />
      <TabRow active={tab} onChange={setTab} />
      <div className="app-screen">
        {tab === 'live' ? <LiveScreen /> : <ComingSoon screen={SCREEN_LABELS[tab]} />}
      </div>
      <StatusBar />
    </div>
  );
}
