import Store from 'electron-store';
import type { LibraryData, OutputConfig, Template } from '@shared/types';

const defaultTemplates: Template[] = [
  {
    id: 'default-lyrics',
    name: 'Lyrics — Dark',
    background: { type: 'color', value: '#0b0b12' },
    fontFamily: 'Georgia, serif',
    fontSize: 64,
    textColor: '#ffffff',
    textAlign: 'center',
    lowerThird: false,
  },
  {
    id: 'default-verse',
    name: 'Scripture — Dark',
    background: { type: 'color', value: '#101820' },
    fontFamily: 'Georgia, serif',
    fontSize: 52,
    textColor: '#f5e9c9',
    textAlign: 'center',
    lowerThird: false,
  },
  {
    id: 'default-lower-third',
    name: 'Lower Third — Name/Title',
    background: { type: 'color', value: 'transparent' },
    fontFamily: 'Helvetica, Arial, sans-serif',
    fontSize: 40,
    textColor: '#ffffff',
    textAlign: 'left',
    lowerThird: true,
  },
  // A handful of built-in gradient backdrops — generated, not downloaded, so there's no
  // third-party licensing question (unlike stock video loops, most of which forbid redistributing
  // the raw file inside another product even when labelled "free"). Background.value is passed
  // straight into a CSS `background` shorthand, which accepts a gradient string same as a colour.
  {
    id: 'theme-midnight-blue',
    name: 'Midnight Blue',
    background: { type: 'color', value: 'linear-gradient(160deg, #0d2a45, #060c14)' },
    fontFamily: 'Georgia, serif',
    fontSize: 64,
    textColor: '#ffffff',
    textAlign: 'center',
    lowerThird: false,
  },
  {
    id: 'theme-warm-amber',
    name: 'Warm Amber',
    background: { type: 'color', value: 'linear-gradient(160deg, #3a230c, #120904)' },
    fontFamily: 'Georgia, serif',
    fontSize: 64,
    textColor: '#ffffff',
    textAlign: 'center',
    lowerThird: false,
  },
  {
    id: 'theme-deep-purple',
    name: 'Deep Purple',
    background: { type: 'color', value: 'linear-gradient(160deg, #24123a, #0a0512)' },
    fontFamily: 'Georgia, serif',
    fontSize: 64,
    textColor: '#ffffff',
    textAlign: 'center',
    lowerThird: false,
  },
  {
    id: 'theme-forest-green',
    name: 'Forest Green',
    background: { type: 'color', value: 'linear-gradient(160deg, #0c3a23, #04120a)' },
    fontFamily: 'Georgia, serif',
    fontSize: 64,
    textColor: '#ffffff',
    textAlign: 'center',
    lowerThird: false,
  },
  {
    id: 'theme-charcoal',
    name: 'Charcoal',
    background: { type: 'color', value: 'linear-gradient(160deg, #2a2a2e, #101012)' },
    fontFamily: 'Georgia, serif',
    fontSize: 64,
    textColor: '#ffffff',
    textAlign: 'center',
    lowerThird: false,
  },
  {
    id: 'theme-ntcg-brand',
    name: 'NTCG Brand',
    // A toned-down, darkened version of the church's own #1B75BB (see DESIGN-SPEC.md §2) — full
    // brightness would fight with lyric text, but a dark-to-navy gradient still reads as "theirs."
    background: { type: 'color', value: 'linear-gradient(160deg, #123c56, #05141d)' },
    fontFamily: 'Georgia, serif',
    fontSize: 64,
    textColor: '#ffffff',
    textAlign: 'center',
    lowerThird: false,
  },
];

/** electron-store's `defaults` only seed a key the first time it doesn't exist on disk — adding
 *  entries here does nothing for an install that already has a templates array saved. Called once
 *  at startup so upgrading to a version with more built-in themes actually adds them. */
function ensureBuiltInTemplates() {
  const existing = store.get('templates');
  const existingIds = new Set(existing.map((t) => t.id));
  const missing = defaultTemplates.filter((t) => !existingIds.has(t.id));
  if (missing.length) store.set('templates', [...existing, ...missing]);
}

const defaultOutputConfigs: OutputConfig[] = [
  { id: 'program-1', role: 'program', name: 'Program (Audience)', displayId: null, chromaKey: '#00ff00', enabled: true },
  { id: 'stage-1', role: 'stage', name: 'Stage Display', displayId: null, chromaKey: '#00ff00', enabled: false },
  { id: 'stream-1', role: 'stream', name: 'Stream (Lower Thirds)', displayId: null, chromaKey: '#00ff00', enabled: false },
];

const defaults: LibraryData = {
  songs: [],
  media: [],
  playlists: [],
  templates: defaultTemplates,
  presentations: [],
  outputConfigs: defaultOutputConfigs,
  logoMediaId: null,
};

export const store = new Store<LibraryData>({
  name: 'church-presenter-library',
  defaults,
});

ensureBuiltInTemplates();

export function getLibrary(): LibraryData {
  return {
    songs: store.get('songs'),
    media: store.get('media'),
    playlists: store.get('playlists'),
    templates: store.get('templates'),
    presentations: store.get('presentations'),
    outputConfigs: store.get('outputConfigs'),
    logoMediaId: store.get('logoMediaId', null),
  };
}
