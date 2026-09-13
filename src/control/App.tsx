import { useEffect } from 'react';
import { useStore } from './store';
import { SchedulePanel } from './components/SchedulePanel';
import { SlideGridPanel } from './components/SlideGridPanel';
import { LiveOutputPanel } from './components/LiveOutputPanel';

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
        <SchedulePanel />
        <SlideGridPanel />
        <LiveOutputPanel />
      </main>
    </div>
  );
}
