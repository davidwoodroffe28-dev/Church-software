import { useEffect } from 'react';
import { useStore } from './store';
import { TitleBar } from './components/TitleBar';
import { TabRow } from './components/TabRow';
import { StatusBar } from './components/StatusBar';
import { HomeScreen } from './components/HomeScreen';
import { LiveScreen } from './components/LiveScreen';
import { StageScreen } from './components/StageScreen';
import { SongsScreen } from './components/SongsScreen';
import { BibleScreen } from './components/BibleScreen';
import { MediaScreen } from './components/MediaScreen';
import { SlidesScreen } from './components/SlidesScreen';
import { ThemesScreen } from './components/ThemesScreen';
import { SettingsScreen } from './components/SettingsScreen';

export function App() {
  const loading = useStore((s) => s.loading);
  const load = useStore((s) => s.load);
  const tab = useStore((s) => s.activeScreen);
  const setTab = useStore((s) => s.setActiveScreen);

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
        {tab === 'home' ? (
          <HomeScreen />
        ) : tab === 'live' ? (
          <LiveScreen />
        ) : tab === 'stage' ? (
          <StageScreen />
        ) : tab === 'songs' ? (
          <SongsScreen />
        ) : tab === 'bible' ? (
          <BibleScreen />
        ) : tab === 'media' ? (
          <MediaScreen />
        ) : tab === 'slides' ? (
          <SlidesScreen />
        ) : tab === 'themes' ? (
          <ThemesScreen />
        ) : (
          <SettingsScreen />
        )}
      </div>
      <StatusBar />
    </div>
  );
}
