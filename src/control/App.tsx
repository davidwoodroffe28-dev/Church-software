import { useEffect } from 'react';
import { useStore } from './store';
import { LibraryPanel } from './components/LibraryPanel';
import { PlaylistPanel } from './components/PlaylistPanel';
import { PreviewLivePanel } from './components/PreviewLivePanel';

export function App() {
  const loading = useStore((s) => s.loading);
  const load = useStore((s) => s.load);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <div className="app-loading">Loading library…</div>;
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Church Presenter</h1>
      </header>
      <main className="app-body">
        <LibraryPanel />
        <PlaylistPanel />
        <PreviewLivePanel />
      </main>
    </div>
  );
}
