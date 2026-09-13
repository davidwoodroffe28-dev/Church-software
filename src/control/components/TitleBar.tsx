import { useStore, useActivePlaylist } from '../store';

export function TitleBar() {
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const liveItemId = useStore((s) => s.liveItemId);
  const playlist = useActivePlaylist();

  return (
    <div className="title-bar">
      <div className="title-bar-left">
        <span className="title-bar-app">Sanctuary</span>
        <span className="title-bar-sep">·</span>
        <span className="title-bar-service">{playlist?.name ?? 'Untitled service'}</span>
        <span className="title-bar-sep">·</span>
        <span className="title-bar-saved">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          Saved
        </span>
      </div>
      <div className="title-bar-right">
        {liveItemId && <span className="on-air-chip">ON AIR</span>}
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {theme === 'dark' ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"></path>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4"></circle>
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"></path>
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
