import { useStore } from '../store';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatUpdated(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const ICONS = {
  newService: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  songs: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l10-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="16" cy="16" r="3" />
    </svg>
  ),
  bible: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  ),
  media: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" />
    </svg>
  ),
};

export function HomeScreen() {
  const library = useStore((s) => s.library);
  const activePlaylistId = useStore((s) => s.activePlaylistId);
  const setActiveScreen = useStore((s) => s.setActiveScreen);
  const setActivePlaylistId = useStore((s) => s.setActivePlaylistId);
  const createPlaylist = useStore((s) => s.createPlaylist);

  if (!library) return null;

  const activePlaylist = library.playlists.find((p) => p.id === activePlaylistId) ?? null;
  const otherPlaylists = library.playlists
    .filter((p) => p.id !== activePlaylistId)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="home-screen">
      <div className="home-greeting serif">{greeting()}</div>

      {activePlaylist && (
        <button className="continue-card" onClick={() => setActiveScreen('live')}>
          <div className="continue-card-label mono">CONTINUE</div>
          <div className="continue-card-title">{activePlaylist.name}</div>
          <div className="continue-card-meta">
            {activePlaylist.items.length} item{activePlaylist.items.length === 1 ? '' : 's'} · updated{' '}
            {formatUpdated(activePlaylist.updatedAt)}
          </div>
          <div className="continue-card-arrow">→</div>
        </button>
      )}

      <div className="home-actions">
        <button className="action-card" onClick={() => createPlaylist('New Service').then(() => setActiveScreen('live'))}>
          <span className="action-card-icon">{ICONS.newService}</span>
          New service
        </button>
        <button className="action-card" onClick={() => setActiveScreen('songs')}>
          <span className="action-card-icon">{ICONS.songs}</span>
          Import songs
        </button>
        <button className="action-card" onClick={() => setActiveScreen('bible')}>
          <span className="action-card-icon">{ICONS.bible}</span>
          Search Bible
        </button>
        <button className="action-card" onClick={() => setActiveScreen('media')}>
          <span className="action-card-icon">{ICONS.media}</span>
          Add media
        </button>
      </div>

      <div className="recent-schedules">
        <div className="column-title mono">RECENT SCHEDULES</div>
        {otherPlaylists.length === 0 ? (
          <p className="hint">Other services you create will show up here.</p>
        ) : (
          <table className="recent-table">
            <tbody>
              {otherPlaylists.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => {
                    setActivePlaylistId(p.id);
                    setActiveScreen('live');
                  }}
                >
                  <td className="recent-table-name">{p.name}</td>
                  <td className="mono recent-table-meta">{p.items.length} ITEMS</td>
                  <td className="mono recent-table-meta">{formatUpdated(p.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
