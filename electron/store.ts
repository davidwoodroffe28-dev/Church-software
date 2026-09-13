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
];

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
};

export const store = new Store<LibraryData>({
  name: 'church-presenter-library',
  defaults,
});

export function getLibrary(): LibraryData {
  return {
    songs: store.get('songs'),
    media: store.get('media'),
    playlists: store.get('playlists'),
    templates: store.get('templates'),
    presentations: store.get('presentations'),
    outputConfigs: store.get('outputConfigs'),
  };
}
