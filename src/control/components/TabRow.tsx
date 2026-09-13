export type ScreenTab = 'home' | 'live' | 'songs' | 'bible' | 'media' | 'themes' | 'stage' | 'settings';

const TABS: { id: ScreenTab; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'live', label: 'Live' },
  { id: 'songs', label: 'Songs' },
  { id: 'bible', label: 'Bible' },
  { id: 'media', label: 'Media' },
  { id: 'themes', label: 'Themes' },
  { id: 'stage', label: 'Stage' },
  { id: 'settings', label: 'Settings' },
];

export function TabRow({ active, onChange }: { active: ScreenTab; onChange: (tab: ScreenTab) => void }) {
  return (
    <div className="tab-row">
      {TABS.map((t) => (
        <button key={t.id} className={'nav-tab' + (t.id === active ? ' active' : '')} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
