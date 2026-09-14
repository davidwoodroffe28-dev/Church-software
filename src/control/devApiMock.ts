import { v4 as uuid } from 'uuid';
import type { BibleVerse, LibraryData, Song, Template } from '@shared/types';
import type { ControlApi } from '@shared/api';

const templates: Template[] = [
  {
    id: 'default-lyrics',
    name: 'Lyrics — Dark',
    background: { type: 'color', value: '#0c0e11' },
    fontFamily: 'Georgia, serif',
    fontSize: 64,
    textColor: '#ffffff',
    textAlign: 'center',
    lowerThird: false,
  },
  {
    id: 'default-verse',
    name: 'Scripture — Dark',
    background: { type: 'color', value: '#0c0e11' },
    fontFamily: 'Georgia, serif',
    fontSize: 52,
    textColor: '#f5e9c9',
    textAlign: 'center',
    lowerThird: false,
  },
];

function section(label: string, text: string) {
  return { id: uuid(), label, text };
}

function song(title: string, author: string, sectionSpecs: [string, string][]): Song {
  const sections = sectionSpecs.map(([label, text]) => section(label, text));
  return {
    id: uuid(),
    title,
    author,
    sections,
    sequence: sections.map((s) => s.id),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

const amazingGrace = song('Amazing Grace', 'John Newton', [
  ['Verse 1', 'Amazing grace, how sweet the sound\nthat saved a wretch like me;'],
  ['Chorus', "'Twas grace that taught my heart to fear,\nand grace my fears relieved;"],
  ['Verse 2', 'I once was lost, but now am found,\nwas blind, but now I see.'],
  ['Verse 3', 'Through many dangers, toils and snares,\nI have already come;'],
]);

const howGreat = song('How Great Thou Art', 'Stuart K. Hine', [
  ['Verse 1', 'O Lord my God, when I in awesome wonder\nconsider all the worlds Thy hands have made;'],
  ['Chorus', 'Then sings my soul, my Saviour God, to Thee:\nHow great Thou art, how great Thou art!'],
]);

const closingSong = song('Closing Song', '', [
  ['Verse 1', 'Go now in peace, go now in peace,\nmay the love of God surround you.'],
]);

const placeholderImage =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#23272d"/><rect x="240" y="130" width="160" height="100" rx="8" fill="none" stroke="#1b75bb" stroke-width="6"/><path d="M290 160 L330 180 L290 200 Z" fill="#1b75bb"/></svg>'
  );

const library: LibraryData = {
  songs: [amazingGrace, howGreat, closingSong],
  media: [
    { id: uuid(), name: 'Worship background', type: 'image', filePath: placeholderImage, addedAt: Date.now() },
  ],
  presentations: [],
  templates,
  outputConfigs: [
    { id: 'program-1', role: 'program', name: 'Program (Audience)', displayId: null, chromaKey: '#00ff00', enabled: true },
    { id: 'stage-1', role: 'stage', name: 'Stage Display', displayId: null, chromaKey: '#00ff00', enabled: true },
    { id: 'stream-1', role: 'stream', name: 'Stream (Lower Thirds)', displayId: null, chromaKey: '#00ff00', enabled: false },
  ],
  playlists: [
    {
      id: uuid(),
      name: 'Sunday Service',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      items: [
        { id: uuid(), type: 'lowerThird', label: 'Welcome & Announcements', customText: 'Welcome & Announcements' },
        { id: uuid(), type: 'song', refId: amazingGrace.id, label: amazingGrace.title },
        { id: uuid(), type: 'song', refId: howGreat.id, label: howGreat.title },
        {
          id: uuid(),
          type: 'verse',
          label: 'Romans 8:28',
          bible: {
            translation: 'KJV',
            book: 'Romans',
            chapter: 8,
            verseStart: 28,
            text: 'And we know that all things work together for good to them that love God, to them who are the called according to his purpose.',
          },
        },
        { id: uuid(), type: 'song', refId: closingSong.id, label: closingSong.title },
      ],
    },
  ],
};

const sampleVerses: BibleVerse[] = [
  { book: 'John', chapter: 3, verse: 16, text: 'For God so loved the world, that he gave his only begotten Son...' },
  { book: 'Psalms', chapter: 23, verse: 1, text: 'The LORD is my shepherd; I shall not want.' },
];

/** Only installed when window.api is missing (i.e. this page was opened in a plain browser tab
 *  instead of the Electron control window) — lets the UI be previewed/screenshotted without
 *  packaging or launching Electron. Never runs inside the real app, where preload always supplies
 *  a real window.api. */
export function installDevApiMock() {
  const mockApi: ControlApi = {
    library: {
      get: async () => structuredClone(library),
      saveSongs: async () => true,
      saveMedia: async () => true,
      savePlaylists: async () => true,
      saveTemplates: async () => true,
      savePresentations: async () => true,
      saveOutputConfigs: async () => true,
    },
    dialogs: {
      pickMediaFiles: async () => ({ items: [], warnings: [] }),
    },
    songs: {
      importFiles: async () => ({ songs: [], errors: [] }),
      importFolder: async () => ({ songs: [], errors: [] }),
      importEasyWorship: async () => ({ songs: [], errors: [] }),
    },
    presentations: {
      import: async () => ({ error: 'Presentation import is not available in the browser preview.' }),
    },
    live: {
      goLive: async () => true,
      clear: async () => true,
    },
    displays: {
      list: async () => [],
      sync: async () => true,
      getStatus: async () => [
        { id: 'program-1', open: true },
        { id: 'stage-1', open: true },
        { id: 'stream-1', open: false },
      ],
      onStatus: () => () => {},
    },
    bible: {
      getTranslations: async () => [{ code: 'kjv', name: 'King James Version' }],
      getBooks: async () => ['Genesis', 'Psalms', 'John', 'Romans'],
      getChapterCount: async () => 8,
      getChapterVerses: async (_translation, book, chapter) =>
        Array.from({ length: 6 }, (_, i) => ({
          book,
          chapter,
          verse: i + 1,
          text: `Sample verse text for ${book} ${chapter}:${i + 1} — the browser preview doesn't load the real Bible dataset.`,
        })),
      search: async (_translation, query) =>
        query.trim() ? sampleVerses.filter((v) => v.book.toLowerCase().includes(query.toLowerCase())) : [],
    },
    remote: {
      start: async () => ({ running: false, url: null, qrDataUrl: null }),
      stop: async () => true,
      getStatus: async () => ({ running: false, url: null, qrDataUrl: null }),
      onAction: () => () => {},
      pushQueue: async () => true,
    },
  };

  (window as unknown as { api: ControlApi }).api = mockApi;
}
