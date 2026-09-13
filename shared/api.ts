// Type contract for window.api (control window) and window.outputApi (output windows).
// Defined independently of the electron module so the renderer (Vite/browser TS project) can
// import these types without pulling in the electron-targeted tsconfig.
import type {
  BibleVerse,
  LibraryData,
  MediaItem,
  OutputConfig,
  Playlist,
  Presentation,
  ProgramState,
  Song,
  Template,
} from './types';

export interface DisplayInfo {
  id: number;
  label: string;
  isPrimary: boolean;
}

export interface OutputStatus {
  id: string;
  open: boolean;
}

export interface RemoteStatus {
  running: boolean;
  url: string | null;
  qrDataUrl: string | null;
}

export type RemoteActionType = 'next' | 'prev' | 'black' | 'clear';

export interface ImportResult {
  presentation?: Presentation;
  error?: string;
  warning?: string;
}

export interface SongImportResult {
  songs: Song[];
  errors: string[];
}

export interface EasyWorshipImportResult {
  songs: Song[];
  errors: string[];
  warning?: string;
}

export interface ControlApi {
  library: {
    get: () => Promise<LibraryData>;
    saveSongs: (songs: Song[]) => Promise<boolean>;
    saveMedia: (media: MediaItem[]) => Promise<boolean>;
    savePlaylists: (playlists: Playlist[]) => Promise<boolean>;
    saveTemplates: (templates: Template[]) => Promise<boolean>;
    savePresentations: (presentations: Presentation[]) => Promise<boolean>;
    saveOutputConfigs: (configs: OutputConfig[]) => Promise<boolean>;
  };
  dialogs: {
    pickMediaFiles: () => Promise<MediaItem[]>;
  };
  songs: {
    importFiles: () => Promise<SongImportResult>;
    importFolder: () => Promise<SongImportResult>;
    importEasyWorship: () => Promise<EasyWorshipImportResult>;
  };
  presentations: {
    import: () => Promise<ImportResult>;
  };
  live: {
    goLive: (state: ProgramState) => Promise<boolean>;
    clear: () => Promise<boolean>;
  };
  displays: {
    list: () => Promise<DisplayInfo[]>;
    sync: () => Promise<boolean>;
    getStatus: () => Promise<OutputStatus[]>;
    onStatus: (cb: (statuses: OutputStatus[]) => void) => () => void;
  };
  bible: {
    getTranslations: () => Promise<{ code: string; name: string }[]>;
    getBooks: (translationCode: string) => Promise<string[]>;
    getChapterCount: (translationCode: string, book: string) => Promise<number>;
    getChapterVerses: (translationCode: string, book: string, chapter: number) => Promise<BibleVerse[]>;
    search: (translationCode: string, query: string) => Promise<BibleVerse[]>;
  };
  remote: {
    start: () => Promise<RemoteStatus>;
    stop: () => Promise<boolean>;
    getStatus: () => Promise<RemoteStatus>;
    onAction: (cb: (type: RemoteActionType) => void) => () => void;
  };
}

export interface OutputApi {
  onProgramState: (cb: (state: ProgramState) => void) => () => void;
}
