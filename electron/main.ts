import { app, BrowserWindow, ipcMain, dialog, screen } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Channels } from './ipcChannels';
import { getLibrary, store } from './store';
import { importPresentation } from './presentations';
import { importSongFile, importSongsFromFolder } from './songImport';
import { importEasyWorshipDatabase } from './easyworshipImport';
import { TRANSLATIONS, getBooks, getChapterCount, getChapterVerses, searchVerses } from './bible';
import { startRemoteServer, stopRemoteServer, getRemoteStatusWithQr, updateRemoteState, type RemoteActionType } from './remoteServer';
import type { MediaItem, OutputConfig, ProgramState } from '@shared/types';

const isDev = process.env.NODE_ENV === 'development';

// build-assets ships alongside dist-electron in both dev (repo root) and packaged (files entry in
// package.json's build config) layouts, so the same relative path resolves in both.
const appIconPath = path.join(
  __dirname,
  '..',
  '..',
  'build-assets',
  process.platform === 'win32' ? 'icon.ico' : 'icon.png'
);

let controlWindow: BrowserWindow | null = null;
const outputWindows = new Map<string, BrowserWindow>();
let lastProgramState: ProgramState = { current: { kind: 'blank' } };

function loadRendererPage(win: BrowserWindow, page: 'index' | 'output', query = '') {
  if (isDev) {
    win.loadURL(`http://localhost:5173/${page === 'index' ? '' : 'output.html'}${query}`);
  } else {
    win.loadFile(path.join(__dirname, '..', '..', 'dist', page === 'index' ? 'index.html' : 'output.html'), {
      search: query.replace(/^\?/, ''),
    });
  }
}

function createControlWindow() {
  controlWindow = new BrowserWindow({
    width: 1480,
    height: 900,
    // The renderer's layout floor is 1420x780 (DESIGN-SPEC.md — panels never compress below it);
    // the previous default (1360x860) was narrower than that, so the window opened already
    // horizontally clipped/scrolled on a fresh install.
    minWidth: 1420,
    minHeight: 800,
    title: 'Sanctuary',
    icon: appIconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // The default sandboxed preload context can only require() Node built-ins/'electron', not
      // local project files (our preload imports ./ipcChannels) — disable it for the preload only;
      // contextIsolation (the actual renderer/main isolation boundary) stays on.
      sandbox: false,
      // Chromium normally blocks unmuted <video autoplay> without a prior user gesture in that
      // frame — but slide changes here are driven by IPC, not a click inside the video's own
      // document, so without this a full-frame media item with real audio would silently fail to
      // play sound. Background-layer video (behind lyrics/scripture) stays explicitly muted in
      // SlideView regardless of this policy — this only affects videos that opt in by not muting.
      autoplayPolicy: 'no-user-gesture-required',
    },
  });
  loadRendererPage(controlWindow, 'index');
  if (isDev) controlWindow.webContents.openDevTools({ mode: 'detach' });
  controlWindow.on('closed', () => {
    controlWindow = null;
  });
}

function computeOutputStatuses() {
  return store.get('outputConfigs').map((c) => ({ id: c.id, open: outputWindows.has(c.id) }));
}

function notifyOutputStatus() {
  controlWindow?.webContents.send(Channels.OutputWindowStatus, computeOutputStatuses());
}

function createOutputWindow(config: OutputConfig) {
  const displays = screen.getAllDisplays();
  const display = config.displayId != null ? displays.find((d) => d.id === config.displayId) : undefined;

  const win = new BrowserWindow({
    x: display ? display.bounds.x + 40 : undefined,
    y: display ? display.bounds.y + 40 : undefined,
    width: display ? display.bounds.width : 960,
    height: display ? display.bounds.height : 540,
    fullscreen: !!display && !isDev,
    frame: !display || isDev,
    autoHideMenuBar: true,
    backgroundColor: config.role === 'stream' ? undefined : '#000000',
    transparent: config.role === 'stream',
    title: `Sanctuary — ${config.name}`,
    icon: appIconPath,
    webPreferences: {
      preload: path.join(__dirname, 'outputPreload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      autoplayPolicy: 'no-user-gesture-required',
    },
  });

  const query = `?role=${config.role}&outputId=${encodeURIComponent(config.id)}&chroma=${encodeURIComponent(config.chromaKey)}`;
  loadRendererPage(win, 'output', query);

  win.on('closed', () => {
    outputWindows.delete(config.id);
    notifyOutputStatus();
  });
  win.webContents.on('did-finish-load', () => {
    win.webContents.send(Channels.ProgramStateUpdate, lastProgramState);
    notifyOutputStatus();
  });

  outputWindows.set(config.id, win);
}

/** Reconciles running output windows against the persisted OutputConfig list: opens/closes/moves as needed. */
function syncOutputWindows() {
  const configs = store.get('outputConfigs');
  const wantedIds = new Set(configs.filter((c) => c.enabled).map((c) => c.id));

  for (const [id, win] of outputWindows) {
    if (!wantedIds.has(id)) {
      win.close();
    }
  }
  for (const config of configs) {
    if (config.enabled && !outputWindows.has(config.id)) {
      createOutputWindow(config);
    }
  }
  notifyOutputStatus();
}

app.whenReady().then(() => {
  createControlWindow();
  syncOutputWindows();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createControlWindow();
      syncOutputWindows();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---- IPC handlers ----

ipcMain.handle(Channels.GetLibrary, () => getLibrary());

ipcMain.handle(Channels.SaveSongs, (_e, songs) => {
  store.set('songs', songs);
  return true;
});
ipcMain.handle(Channels.SaveMedia, (_e, media) => {
  store.set('media', media);
  return true;
});
ipcMain.handle(Channels.SavePlaylists, (_e, playlists) => {
  store.set('playlists', playlists);
  return true;
});
ipcMain.handle(Channels.SaveTemplates, (_e, templates) => {
  store.set('templates', templates);
  return true;
});
ipcMain.handle(Channels.SavePresentations, (_e, presentations) => {
  store.set('presentations', presentations);
  return true;
});
ipcMain.handle(Channels.SaveOutputConfigs, (_e, outputConfigs: OutputConfig[]) => {
  store.set('outputConfigs', outputConfigs);
  syncOutputWindows();
  return true;
});

ipcMain.handle(Channels.PickMediaFiles, async () => {
  if (!controlWindow) return [];
  const result = await dialog.showOpenDialog(controlWindow, {
    title: 'Add media',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] },
      { name: 'Videos', extensions: ['mp4', 'webm', 'mov', 'mkv'] },
    ],
  });
  if (result.canceled) return [];
  const items: MediaItem[] = result.filePaths.map((filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    const isVideo = ['.mp4', '.webm', '.mov', '.mkv'].includes(ext);
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: path.basename(filePath),
      type: isVideo ? 'video' : 'image',
      filePath: pathToFileURL(filePath).href,
      addedAt: Date.now(),
    };
  });
  return items;
});

ipcMain.handle(Channels.ImportSongsFiles, async () => {
  if (!controlWindow) return { songs: [], errors: ['No control window'] };
  const result = await dialog.showOpenDialog(controlWindow, {
    title: 'Import songs',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Song files', extensions: ['xml', 'csv', 'txt', 'cho', 'chordpro', 'usr'] },
      { name: 'All files', extensions: ['*'] },
    ],
  });
  if (result.canceled) return { songs: [], errors: [] };
  const songs = [];
  const errors: string[] = [];
  for (const filePath of result.filePaths) {
    const r = importSongFile(filePath);
    songs.push(...r.songs);
    errors.push(...r.errors);
  }
  return { songs, errors };
});

ipcMain.handle(Channels.ImportSongsFolder, async () => {
  if (!controlWindow) return { songs: [], errors: ['No control window'] };
  const result = await dialog.showOpenDialog(controlWindow, {
    title: 'Import songs from folder',
    properties: ['openDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) return { songs: [], errors: [] };
  return importSongsFromFolder(result.filePaths[0]);
});

ipcMain.handle(Channels.ImportEasyWorshipDatabase, async () => {
  if (!controlWindow) return { songs: [], errors: ['No control window'] };
  const result = await dialog.showOpenDialog(controlWindow, {
    title: 'Import EasyWorship song database',
    properties: ['openFile'],
    filters: [
      { name: 'EasyWorship database', extensions: ['db', 'sdf', 'ewdb'] },
      { name: 'All files', extensions: ['*'] },
    ],
  });
  if (result.canceled || result.filePaths.length === 0) return { songs: [], errors: [] };
  return importEasyWorshipDatabase(result.filePaths[0]);
});

ipcMain.handle(Channels.ImportPresentation, async () => {
  if (!controlWindow) return { error: 'No control window' };
  const result = await dialog.showOpenDialog(controlWindow, {
    title: 'Import PowerPoint presentation',
    properties: ['openFile'],
    filters: [{ name: 'PowerPoint', extensions: ['pptx', 'ppt'] }],
  });
  if (result.canceled || result.filePaths.length === 0) return {};
  return importPresentation(result.filePaths[0]);
});

ipcMain.handle(Channels.GoLive, (_e, state: ProgramState) => {
  lastProgramState = state;
  for (const win of outputWindows.values()) {
    win.webContents.send(Channels.ProgramStateUpdate, state);
  }
  updateRemoteState(state);
  return true;
});

ipcMain.handle(Channels.ClearLive, () => {
  lastProgramState = { current: { kind: 'blank' } };
  for (const win of outputWindows.values()) {
    win.webContents.send(Channels.ProgramStateUpdate, lastProgramState);
  }
  updateRemoteState(lastProgramState);
  return true;
});

ipcMain.handle(Channels.RemoteStart, async () => {
  startRemoteServer((type: RemoteActionType) => {
    controlWindow?.webContents.send(Channels.RemoteAction, type);
  });
  updateRemoteState(lastProgramState);
  return getRemoteStatusWithQr();
});

ipcMain.handle(Channels.RemoteStop, () => {
  stopRemoteServer();
  return true;
});

ipcMain.handle(Channels.RemoteGetStatus, () => getRemoteStatusWithQr());

ipcMain.handle(Channels.ListDisplays, () => {
  const primaryId = screen.getPrimaryDisplay().id;
  return screen.getAllDisplays().map((d) => ({
    id: d.id,
    label: `${d.size.width}x${d.size.height}${d.id === primaryId ? ' (Primary)' : ''}`,
    isPrimary: d.id === primaryId,
  }));
});

ipcMain.handle(Channels.SyncOutputWindows, () => {
  syncOutputWindows();
  return true;
});

ipcMain.handle(Channels.GetOutputStatus, () => computeOutputStatuses());

ipcMain.handle(Channels.BibleGetTranslations, () => TRANSLATIONS);

ipcMain.handle(Channels.BibleGetBooks, (_e, translationCode: string) => getBooks(translationCode));

ipcMain.handle(Channels.BibleGetChapterCount, (_e, translationCode: string, book: string) =>
  getChapterCount(translationCode, book)
);

ipcMain.handle(Channels.BibleGetChapterVerses, (_e, translationCode: string, book: string, chapter: number) =>
  getChapterVerses(translationCode, book, chapter)
);

ipcMain.handle(Channels.BibleSearch, (_e, translationCode: string, query: string) =>
  searchVerses(translationCode, query)
);
