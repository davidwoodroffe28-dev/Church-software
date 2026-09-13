import { useMemo } from 'react';
import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import type {
  LibraryData,
  MediaItem,
  OutputConfig,
  Playlist,
  PlaylistItem,
  ProgramState,
  Song,
  SongSection,
  Template,
} from '@shared/types';
import type { OutputStatus, RemoteStatus } from '@shared/api';
import { buildLiveSlide, getNextSlide, getSubSlideCount } from './slideBuilder';

interface Selection {
  itemId: string | null;
  subIndex: number;
}

type Theme = 'dark' | 'light';

export type ScreenTab = 'home' | 'live' | 'songs' | 'bible' | 'media' | 'themes' | 'stage' | 'settings';

interface AppState {
  loading: boolean;
  library: LibraryData | null;
  activePlaylistId: string | null;
  selection: Selection;
  stageMessage: string;
  stageClock: boolean;
  liveItemId: string | null;
  liveSubIndex: number;
  liveTextVisible: boolean;
  liveBackgroundVisible: boolean;
  outputStatuses: OutputStatus[];
  theme: Theme;
  activeScreen: ScreenTab;
  remoteStatus: RemoteStatus;
  remoteBusy: boolean;

  load: () => Promise<void>;
  toggleTheme: () => void;
  setActiveScreen: (screen: ScreenTab) => void;
  setActivePlaylistId: (id: string) => void;
  createPlaylist: (name: string) => Promise<void>;

  // Songs
  upsertSong: (song: Song) => Promise<void>;
  deleteSong: (id: string) => Promise<void>;
  toggleSongFavorite: (id: string) => Promise<void>;
  /** Adds a song to the active service AND stamps lastUsedAt on it, so the Library's "recently
   *  used" ordering reflects songs actually pulled into a service, not just edited. */
  addSongToService: (song: Song) => Promise<void>;
  importSongsFiles: () => Promise<{ imported: number; errors: string[] }>;
  importSongsFolder: () => Promise<{ imported: number; errors: string[] }>;
  importEasyWorship: () => Promise<{ imported: number; errors: string[]; warning?: string }>;

  // Media
  importMediaFiles: () => Promise<void>;
  deleteMedia: (id: string) => Promise<void>;

  // Themes (Templates)
  upsertTemplate: (template: Template) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;

  // Presentations
  importPresentation: () => Promise<{ error: string | null; warning?: string }>;
  correctPresentationSlideCount: (id: string, slideCount: number) => Promise<void>;

  // Playlist
  activePlaylist: () => Playlist | null;
  addPlaylistItem: (item: Omit<PlaylistItem, 'id'>) => Promise<PlaylistItem>;
  removePlaylistItem: (itemId: string) => Promise<void>;
  moveItem: (itemId: string, direction: -1 | 1) => Promise<void>;
  /** targetId null = drop past the last item (append at the end). */
  reorderItem: (draggedId: string, targetId: string | null, position?: 'before' | 'after') => Promise<void>;

  // Selection / live
  select: (itemId: string, subIndex?: number) => void;
  stepSubSlide: (direction: -1 | 1) => void;
  /** Advances the on-air slide directly (Live pane's own transport), independent of Preview's
   *  selection — crosses into the next/previous service item once the current one runs out. */
  stepLive: (direction: -1 | 1) => void;
  /** Jumps the on-air slide directly to a sub-slide within the current live item (e.g. clicking a
   *  specific verse row in the Live pane's slide list). */
  setLiveSubIndex: (subIndex: number) => void;
  goLive: () => Promise<void>;
  clearLive: () => Promise<void>;
  clearText: () => Promise<void>;
  clearBackground: () => Promise<void>;
  restoreText: () => Promise<void>;
  restoreBackground: () => Promise<void>;
  /** "Black" — blanks both text and background at once; toggling again restores both. */
  toggleBlack: () => Promise<void>;
  setStageMessage: (text: string) => Promise<void>;
  setStageClock: (on: boolean) => Promise<void>;

  // Outputs
  saveOutputConfigs: (configs: OutputConfig[]) => Promise<void>;
  refreshOutputStatuses: () => void;

  // Mobile remote control
  startRemote: () => Promise<void>;
  stopRemote: () => Promise<void>;
}

function sendProgramState(get: () => AppState) {
  const state = get();
  const library = state.library;
  if (!library) return;
  const playlist = state.activePlaylist();
  const item = playlist?.items.find((i) => i.id === state.liveItemId) ?? null;
  const current = item ? buildLiveSlide(item, state.liveSubIndex, library) : { kind: 'blank' as const };
  const next = getNextSlide(playlist, state.liveItemId, state.liveSubIndex, library);

  const programState: ProgramState = {
    current,
    next,
    stageMessage: state.stageMessage,
    stageClock: state.stageClock,
    textVisible: state.liveTextVisible,
    backgroundVisible: state.liveBackgroundVisible,
  };
  window.api.live.goLive(programState);
}

function loadStoredTheme(): Theme {
  try {
    return localStorage.getItem('sanctuary-theme') === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

function applyThemeToDocument(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

export const useStore = create<AppState>((set, get) => ({
  loading: true,
  library: null,
  activePlaylistId: null,
  selection: { itemId: null, subIndex: 0 },
  stageMessage: '',
  stageClock: true,
  liveItemId: null,
  liveSubIndex: 0,
  liveTextVisible: true,
  liveBackgroundVisible: true,
  outputStatuses: [],
  theme: loadStoredTheme(),
  activeScreen: 'home',
  remoteStatus: { running: false, url: null, qrDataUrl: null },
  remoteBusy: false,

  setActiveScreen: (screen) => set({ activeScreen: screen }),

  setActivePlaylistId: (id) => set({ activePlaylistId: id, selection: { itemId: null, subIndex: 0 } }),

  createPlaylist: async (name) => {
    const library = get().library;
    if (!library) return;
    const playlist: Playlist = {
      id: uuid(),
      name: name.trim() || 'Untitled Service',
      items: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const playlists = [...library.playlists, playlist];
    await window.api.library.savePlaylists(playlists);
    set({ library: { ...library, playlists }, activePlaylistId: playlist.id, selection: { itemId: null, subIndex: 0 } });
  },

  toggleTheme: () => {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark';
    applyThemeToDocument(next);
    try {
      localStorage.setItem('sanctuary-theme', next);
    } catch {
      // localStorage unavailable — theme just won't persist across restarts.
    }
    set({ theme: next });
  },

  load: async () => {
    applyThemeToDocument(get().theme);
    const library = await window.api.library.get();
    let activePlaylistId = library.playlists[0]?.id ?? null;
    if (!activePlaylistId) {
      const playlist: Playlist = {
        id: uuid(),
        name: 'Sunday Service',
        items: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      library.playlists.push(playlist);
      await window.api.library.savePlaylists(library.playlists);
      activePlaylistId = playlist.id;
    }
    set({ library, activePlaylistId, loading: false });
    window.api.displays.onStatus((statuses) => set({ outputStatuses: statuses }));
    const initialStatuses = await window.api.displays.getStatus();
    set({ outputStatuses: initialStatuses });

    // A phone connected to the remote-control page (Settings > Remote Control) sends these —
    // route them through the same actions the control window's own buttons/keyboard use.
    window.api.remote.onAction((type) => {
      const state = get();
      if (type === 'next') state.stepLive(1);
      else if (type === 'prev') state.stepLive(-1);
      else if (type === 'black') state.toggleBlack();
      else if (type === 'clear') (state.liveTextVisible ? state.clearText : state.restoreText)();
    });
    const remoteStatus = await window.api.remote.getStatus();
    set({ remoteStatus });
  },

  upsertSong: async (song) => {
    const library = get().library;
    if (!library) return;
    const idx = library.songs.findIndex((s) => s.id === song.id);
    const songs = [...library.songs];
    if (idx >= 0) songs[idx] = song;
    else songs.push(song);
    await window.api.library.saveSongs(songs);
    set({ library: { ...library, songs } });
  },

  deleteSong: async (id) => {
    const library = get().library;
    if (!library) return;
    const songs = library.songs.filter((s) => s.id !== id);
    await window.api.library.saveSongs(songs);
    set({ library: { ...library, songs } });
  },

  toggleSongFavorite: async (id) => {
    const library = get().library;
    if (!library) return;
    const songs = library.songs.map((s) => (s.id === id ? { ...s, favorite: !s.favorite } : s));
    await window.api.library.saveSongs(songs);
    set({ library: { ...library, songs } });
  },

  addSongToService: async (song) => {
    await get().addPlaylistItem({ type: 'song', refId: song.id, label: song.title });
    const library = get().library;
    if (!library) return;
    const songs = library.songs.map((s) => (s.id === song.id ? { ...s, lastUsedAt: Date.now() } : s));
    await window.api.library.saveSongs(songs);
    set({ library: { ...library, songs } });
  },

  importSongsFiles: async () => {
    const library = get().library;
    if (!library) return { imported: 0, errors: ['Library not loaded yet.'] };
    const result = await window.api.songs.importFiles();
    const songs = [...library.songs, ...result.songs];
    if (result.songs.length) await window.api.library.saveSongs(songs);
    set({ library: { ...library, songs } });
    return { imported: result.songs.length, errors: result.errors };
  },

  importSongsFolder: async () => {
    const library = get().library;
    if (!library) return { imported: 0, errors: ['Library not loaded yet.'] };
    const result = await window.api.songs.importFolder();
    const songs = [...library.songs, ...result.songs];
    if (result.songs.length) await window.api.library.saveSongs(songs);
    set({ library: { ...library, songs } });
    return { imported: result.songs.length, errors: result.errors };
  },

  importEasyWorship: async () => {
    const library = get().library;
    if (!library) return { imported: 0, errors: ['Library not loaded yet.'] };
    const result = await window.api.songs.importEasyWorship();
    const songs = [...library.songs, ...result.songs];
    if (result.songs.length) await window.api.library.saveSongs(songs);
    set({ library: { ...library, songs } });
    return { imported: result.songs.length, errors: result.errors, warning: result.warning };
  },

  importMediaFiles: async () => {
    const library = get().library;
    if (!library) return;
    const picked = await window.api.dialogs.pickMediaFiles();
    if (!picked.length) return;
    const media = [...library.media, ...picked];
    await window.api.library.saveMedia(media);
    set({ library: { ...library, media } });
  },

  deleteMedia: async (id) => {
    const library = get().library;
    if (!library) return;
    const media = library.media.filter((m) => m.id !== id);
    await window.api.library.saveMedia(media);
    set({ library: { ...library, media } });
  },

  upsertTemplate: async (template) => {
    const library = get().library;
    if (!library) return;
    const idx = library.templates.findIndex((t) => t.id === template.id);
    const templates = [...library.templates];
    if (idx >= 0) templates[idx] = template;
    else templates.push(template);
    await window.api.library.saveTemplates(templates);
    set({ library: { ...library, templates } });
  },

  deleteTemplate: async (id) => {
    const library = get().library;
    if (!library) return;
    const templates = library.templates.filter((t) => t.id !== id);
    await window.api.library.saveTemplates(templates);
    set({ library: { ...library, templates } });
  },

  importPresentation: async () => {
    const library = get().library;
    if (!library) return { error: 'Library not loaded yet.' };
    const result = await window.api.presentations.import();
    if (result.error) return { error: result.error };
    if (!result.presentation) return { error: null }; // user canceled
    const presentations = [...library.presentations, result.presentation];
    await window.api.library.savePresentations(presentations);
    set({ library: { ...library, presentations } });
    return { error: null, warning: result.warning };
  },

  correctPresentationSlideCount: async (id, slideCount) => {
    const library = get().library;
    if (!library) return;
    const presentations = library.presentations.map((p) => (p.id === id ? { ...p, slideCount } : p));
    await window.api.library.savePresentations(presentations);
    set({ library: { ...library, presentations } });
  },

  activePlaylist: () => {
    const { library, activePlaylistId } = get();
    return library?.playlists.find((p) => p.id === activePlaylistId) ?? null;
  },

  addPlaylistItem: async (itemData) => {
    const item: PlaylistItem = { ...itemData, id: uuid() };
    const library = get().library;
    const playlist = get().activePlaylist();
    if (!library || !playlist) return item;
    const playlists = library.playlists.map((p) =>
      p.id === playlist.id ? { ...p, items: [...p.items, item], updatedAt: Date.now() } : p
    );
    await window.api.library.savePlaylists(playlists);
    set({ library: { ...library, playlists } });
    return item;
  },

  removePlaylistItem: async (itemId) => {
    const library = get().library;
    const playlist = get().activePlaylist();
    if (!library || !playlist) return;
    const playlists = library.playlists.map((p) =>
      p.id === playlist.id ? { ...p, items: p.items.filter((i) => i.id !== itemId), updatedAt: Date.now() } : p
    );
    await window.api.library.savePlaylists(playlists);
    set({ library: { ...library, playlists } });
  },

  moveItem: async (itemId, direction) => {
    const library = get().library;
    const playlist = get().activePlaylist();
    if (!library || !playlist) return;
    const items = [...playlist.items];
    const idx = items.findIndex((i) => i.id === itemId);
    const swapWith = idx + direction;
    if (idx < 0 || swapWith < 0 || swapWith >= items.length) return;
    [items[idx], items[swapWith]] = [items[swapWith], items[idx]];
    const playlists = library.playlists.map((p) => (p.id === playlist.id ? { ...p, items, updatedAt: Date.now() } : p));
    await window.api.library.savePlaylists(playlists);
    set({ library: { ...library, playlists } });
  },

  reorderItem: async (draggedId, targetId, position = 'before') => {
    const library = get().library;
    const playlist = get().activePlaylist();
    if (!library || !playlist || draggedId === targetId) return;
    const items = [...playlist.items];
    const fromIdx = items.findIndex((i) => i.id === draggedId);
    if (fromIdx < 0) return;
    const [moved] = items.splice(fromIdx, 1);

    let insertIdx: number;
    if (targetId === null) {
      insertIdx = items.length; // drop past the last item: append at the end
    } else {
      // Look up the target's index in the already-shrunk array (after removing the dragged item) —
      // using its pre-removal index here would be off-by-one whenever the drag moves an item forward,
      // since everything after it shifts left by one once removed.
      const targetIdx = items.findIndex((i) => i.id === targetId);
      if (targetIdx < 0) return;
      insertIdx = position === 'after' ? targetIdx + 1 : targetIdx;
    }
    items.splice(insertIdx, 0, moved);

    const playlists = library.playlists.map((p) => (p.id === playlist.id ? { ...p, items, updatedAt: Date.now() } : p));
    await window.api.library.savePlaylists(playlists);
    set({ library: { ...library, playlists } });
  },

  select: (itemId, subIndex = 0) => set({ selection: { itemId, subIndex } }),

  stepSubSlide: (direction) => {
    const { selection, library } = get();
    const playlist = get().activePlaylist();
    if (!selection.itemId || !library || !playlist) return;
    const item = playlist.items.find((i) => i.id === selection.itemId);
    if (!item) return;
    const count = getSubSlideCount(item, library);
    const nextIndex = Math.min(Math.max(selection.subIndex + direction, 0), count - 1);
    set({ selection: { ...selection, subIndex: nextIndex } });
  },

  stepLive: (direction) => {
    const { liveItemId, liveSubIndex, library } = get();
    const playlist = get().activePlaylist();
    if (!liveItemId || !library || !playlist) return;
    const items = playlist.items;
    const idx = items.findIndex((i) => i.id === liveItemId);
    const item = items[idx];
    if (!item) return;

    const count = getSubSlideCount(item, library);
    const nextSub = liveSubIndex + direction;
    if (nextSub >= 0 && nextSub < count) {
      set({ liveSubIndex: nextSub, liveTextVisible: true, liveBackgroundVisible: true });
      sendProgramState(get);
      return;
    }

    const nextItem = items[idx + direction];
    if (!nextItem) return;
    const nextCount = getSubSlideCount(nextItem, library);
    set({
      liveItemId: nextItem.id,
      liveSubIndex: direction > 0 ? 0 : nextCount - 1,
      liveTextVisible: true,
      liveBackgroundVisible: true,
    });
    sendProgramState(get);
  },

  setLiveSubIndex: (subIndex) => {
    if (!get().liveItemId) return;
    set({ liveSubIndex: subIndex, liveTextVisible: true, liveBackgroundVisible: true });
    sendProgramState(get);
  },

  goLive: async () => {
    const { selection } = get();
    if (!selection.itemId) return;
    set({
      liveItemId: selection.itemId,
      liveSubIndex: selection.subIndex,
      liveTextVisible: true,
      liveBackgroundVisible: true,
    });
    sendProgramState(get);
  },

  clearLive: async () => {
    set({ liveItemId: null, liveSubIndex: 0, liveTextVisible: true, liveBackgroundVisible: true });
    await window.api.live.clear();
  },

  clearText: async () => {
    set({ liveTextVisible: false });
    sendProgramState(get);
  },

  clearBackground: async () => {
    set({ liveBackgroundVisible: false });
    sendProgramState(get);
  },

  restoreText: async () => {
    set({ liveTextVisible: true });
    sendProgramState(get);
  },

  restoreBackground: async () => {
    set({ liveBackgroundVisible: true });
    sendProgramState(get);
  },

  toggleBlack: async () => {
    const { liveTextVisible, liveBackgroundVisible } = get();
    const isBlack = !liveTextVisible && !liveBackgroundVisible;
    set({ liveTextVisible: isBlack, liveBackgroundVisible: isBlack });
    sendProgramState(get);
  },

  setStageMessage: async (text) => {
    set({ stageMessage: text });
    sendProgramState(get);
  },

  setStageClock: async (on) => {
    set({ stageClock: on });
    sendProgramState(get);
  },

  saveOutputConfigs: async (configs) => {
    const library = get().library;
    if (!library) return;
    await window.api.library.saveOutputConfigs(configs);
    set({ library: { ...library, outputConfigs: configs } });
  },

  refreshOutputStatuses: () => {
    window.api.displays.sync();
  },

  startRemote: async () => {
    set({ remoteBusy: true });
    const remoteStatus = await window.api.remote.start();
    set({ remoteStatus, remoteBusy: false });
  },

  stopRemote: async () => {
    set({ remoteBusy: true });
    await window.api.remote.stop();
    set({ remoteStatus: { running: false, url: null, qrDataUrl: null }, remoteBusy: false });
  },
}));

/**
 * Reactively reads the active playlist. Prefer this over `useStore(s => s.activePlaylist)()` in
 * components: that pattern selects the (stable, never-changing) function reference itself, so
 * zustand never re-renders on playlist changes — it only appeared to work when some other
 * subscribed piece of state happened to change at the same time (e.g. a tab switch).
 */
export function useActivePlaylist(): Playlist | null {
  const library = useStore((s) => s.library);
  const activePlaylistId = useStore((s) => s.activePlaylistId);
  return useMemo(
    () => library?.playlists.find((p) => p.id === activePlaylistId) ?? null,
    [library, activePlaylistId]
  );
}

export function newSongSection(label: string, text = ''): SongSection {
  return { id: uuid(), label, text };
}

export function newSong(title: string): Song {
  const s1 = newSongSection('Verse 1');
  return {
    id: uuid(),
    title,
    sections: [s1],
    sequence: [s1.id],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function mediaItemLabel(m: MediaItem): string {
  return `${m.name} (${m.type})`;
}

/** Favorites first, then most-recently-used-in-a-service, then alphabetical — the ordering used
 *  everywhere the song library is browsed, so a volunteer's most-reached-for songs are always near
 *  the top instead of buried in an alphabetical list of hundreds. */
export function sortSongsForQuickAccess(songs: Song[]): Song[] {
  return [...songs].sort((a, b) => {
    if (!!b.favorite !== !!a.favorite) return b.favorite ? 1 : -1;
    const usedDelta = (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0);
    if (usedDelta !== 0) return usedDelta;
    return a.title.localeCompare(b.title);
  });
}

export function newTemplate(name: string): Template {
  return {
    id: uuid(),
    name,
    background: { type: 'color', value: '#0c0e11' },
    fontFamily: 'Georgia, serif',
    fontSize: 56,
    textColor: '#ffffff',
    textAlign: 'center',
    lowerThird: false,
  };
}
