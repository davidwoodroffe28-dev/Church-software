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
} from '@shared/types';
import type { OutputStatus } from '@shared/api';
import { buildLiveSlide, getSubSlideCount } from './slideBuilder';

interface Selection {
  itemId: string | null;
  subIndex: number;
}

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

  load: () => Promise<void>;

  // Songs
  upsertSong: (song: Song) => Promise<void>;
  deleteSong: (id: string) => Promise<void>;
  importSongsFiles: () => Promise<{ imported: number; errors: string[] }>;
  importSongsFolder: () => Promise<{ imported: number; errors: string[] }>;
  importEasyWorship: () => Promise<{ imported: number; errors: string[]; warning?: string }>;

  // Media
  importMediaFiles: () => Promise<void>;
  deleteMedia: (id: string) => Promise<void>;

  // Presentations
  importPresentation: () => Promise<{ error: string | null; warning?: string }>;
  correctPresentationSlideCount: (id: string, slideCount: number) => Promise<void>;

  // Playlist
  activePlaylist: () => Playlist | null;
  addPlaylistItem: (item: Omit<PlaylistItem, 'id'>) => Promise<void>;
  removePlaylistItem: (itemId: string) => Promise<void>;
  moveItem: (itemId: string, direction: -1 | 1) => Promise<void>;
  /** targetId null = drop past the last item (append at the end). */
  reorderItem: (draggedId: string, targetId: string | null, position?: 'before' | 'after') => Promise<void>;

  // Selection / live
  select: (itemId: string, subIndex?: number) => void;
  stepSubSlide: (direction: -1 | 1) => void;
  goLive: () => Promise<void>;
  clearLive: () => Promise<void>;
  clearText: () => Promise<void>;
  clearBackground: () => Promise<void>;
  restoreText: () => Promise<void>;
  restoreBackground: () => Promise<void>;
  setStageMessage: (text: string) => Promise<void>;
  setStageClock: (on: boolean) => Promise<void>;

  // Outputs
  saveOutputConfigs: (configs: OutputConfig[]) => Promise<void>;
  refreshOutputStatuses: () => void;
}

function sendProgramState(get: () => AppState) {
  const state = get();
  const library = state.library;
  if (!library) return;
  const playlist = state.activePlaylist();
  const item = playlist?.items.find((i) => i.id === state.liveItemId) ?? null;
  const current = item ? buildLiveSlide(item, state.liveSubIndex, library) : { kind: 'blank' as const };

  let next: ReturnType<typeof buildLiveSlide> | undefined;
  if (item && playlist) {
    const subCount = getSubSlideCount(item, library);
    if (state.liveSubIndex + 1 < subCount) {
      next = buildLiveSlide(item, state.liveSubIndex + 1, library);
    } else {
      const idx = playlist.items.findIndex((i) => i.id === item.id);
      const nextItem = playlist.items[idx + 1];
      if (nextItem) next = buildLiveSlide(nextItem, 0, library);
    }
  }

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

  load: async () => {
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
    const library = get().library;
    const playlist = get().activePlaylist();
    if (!library || !playlist) return;
    const item: PlaylistItem = { ...itemData, id: uuid() };
    const playlists = library.playlists.map((p) =>
      p.id === playlist.id ? { ...p, items: [...p.items, item], updatedAt: Date.now() } : p
    );
    await window.api.library.savePlaylists(playlists);
    set({ library: { ...library, playlists } });
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
