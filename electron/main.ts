import { app, BrowserWindow, ipcMain, dialog, screen } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Channels } from './ipcChannels';
import { getLibrary, store } from './store';
import { importPresentation } from './presentations';
import { importSongFile, importSongsFromFolder } from './songImport';
import { importEasyWorshipDatabase } from './easyworshipImport';
import { TRANSLATIONS, getBooks, getChapterCount, getChapterVerses, searchVerses } from './bible';
import { startRemoteServer, stopRemoteServer, getRemoteStatusWithQr, updateRemoteState, updateRemoteQueue, type RemoteActionType } from './remoteServer';
import { startStreamEmbedServer } from './streamEmbedServer';
import { startNdiSender, stopNdiSender } from './ndiSender';
import type { RemoteQueueItem } from '@shared/api';
import { probeVideoStreams, needsTranscode, transcodeToH264 } from './mediaTranscode';
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
/** windowTargetKey() for each open output window, so syncOutputWindows can tell "still correct"
 *  apart from "needs to move or change visibility". */
const outputWindowTargets = new Map<string, string>();
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
      // In dev, this page loads from http://localhost:5173 (Vite) rather than file:// — Chromium's
      // same-origin policy then blocks *any* file:// media the page references ("Not allowed to
      // load local resource"), independent of codec, which is exactly the "video won't play"
      // reports this was chased down from. Doesn't apply to the packaged app, which loads its own
      // index.html via file:// too (matching origin), so this only relaxes anything during dev.
      webSecurity: !isDev,
    },
  });
  loadRendererPage(controlWindow, 'index');
  if (isDev) {
    controlWindow.webContents.openDevTools({ mode: 'detach' });
    // Renderer console.* calls only show in that window's own DevTools by default — forward them
    // to this process's stdout too, so they show up alongside the main-process logs during dev.
    controlWindow.webContents.on('console-message', (_e, level, message, line, sourceId) => {
      console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`);
    });
  }
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

/** Works out where each enabled output config should actually appear, in one pass so that
 *  'program' and 'stage' auto-assigning to "the next external display" don't both claim the same
 *  screen. displayId null means "pinned to a specific display" wasn't chosen:
 *   - program/stage (physical outputs): auto-claim the next not-yet-claimed non-primary display,
 *     in config order; no display available means no window at all (matches EasyWorship — the
 *     in-app Live preview is the only "output" until a projector/monitor is actually connected).
 *   - stream (OBS/vMix capture or NDI source): stays a plain window regardless of displays, since
 *     that's the deliberate capture target, not a projector feed.
 *  An explicit displayId that's since been unplugged resolves to undefined (window stays closed
 *  until that display comes back) rather than falling back to a stray window on the main screen. */
function resolveOutputTargets(configs: OutputConfig[]): Map<string, Electron.Display | 'windowed'> {
  const displays = screen.getAllDisplays();
  const primaryId = screen.getPrimaryDisplay().id;
  const claimed = new Set<number>();
  const targets = new Map<string, Electron.Display | 'windowed'>();

  for (const config of configs) {
    if (!config.enabled) continue;
    if (config.displayId != null) {
      const explicit = displays.find((d) => d.id === config.displayId);
      if (explicit) {
        claimed.add(explicit.id);
        targets.set(config.id, explicit);
      }
      continue;
    }
    if (config.role === 'stream') {
      targets.set(config.id, 'windowed');
      continue;
    }
    const next = displays.find((d) => d.id !== primaryId && !claimed.has(d.id));
    if (next) {
      claimed.add(next.id);
      targets.set(config.id, next);
    }
  }
  return targets;
}

function createOutputWindow(config: OutputConfig, target: Electron.Display | 'windowed') {
  const display = target === 'windowed' ? undefined : target;
  // Stream/lower-thirds sent purely over NDI has no reason to show a window on screen at all — NDI
  // reads the rendered frames straight off webContents. A visible window here is only needed for
  // the OBS/vMix Window Capture workflow, which has to find an actual on-screen window to grab.
  const hidden = config.role === 'stream' && !display && !!config.ndiEnabled;

  const win = new BrowserWindow({
    x: display ? display.bounds.x + 40 : undefined,
    y: display ? display.bounds.y + 40 : undefined,
    width: display ? display.bounds.width : 960,
    height: display ? display.bounds.height : 540,
    fullscreen: !!display && !isDev,
    frame: !display || isDev,
    show: !hidden,
    skipTaskbar: hidden,
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
      // Keeps rendering (animations, lyric transitions) at full rate while hidden — a backgrounded
      // renderer is throttled by default, which would make the NDI-only feed above stutter.
      backgroundThrottling: false,
      // See createControlWindow's webSecurity comment — output windows load output.html from the
      // same Vite dev server in dev, so they need the same relaxation to play file:// media there.
      webSecurity: !isDev,
    },
  });

  const query = `?role=${config.role}&outputId=${encodeURIComponent(config.id)}&chroma=${encodeURIComponent(config.chromaKey)}`;
  loadRendererPage(win, 'output', query);

  win.on('closed', () => {
    // Guard against a stale close: if a reassignment already replaced this map entry with a newer
    // window for the same config.id (see syncOutputWindows), this late 'closed' must not delete it.
    if (outputWindows.get(config.id) === win) {
      outputWindows.delete(config.id);
      outputWindowTargets.delete(config.id);
    }
    notifyOutputStatus();
  });
  win.webContents.on('did-finish-load', () => {
    win.webContents.send(Channels.ProgramStateUpdate, lastProgramState);
    notifyOutputStatus();
  });

  outputWindows.set(config.id, win);
  outputWindowTargets.set(config.id, windowTargetKey(config, target));
}

/** Identifies "what this window should currently be" — which display (or 'windowed'), plus
 *  whether it should be hidden — so syncOutputWindows can tell a real change (move to a different
 *  display, or an NDI toggle that flips visibility) apart from "nothing to do". */
function windowTargetKey(config: OutputConfig, target: Electron.Display | 'windowed'): string {
  const base = target === 'windowed' ? 'windowed' : String(target.id);
  const hidden = config.role === 'stream' && target === 'windowed' && !!config.ndiEnabled;
  return hidden ? `${base}:hidden` : base;
}

/** Reconciles running output windows against the persisted OutputConfig list and the currently
 *  connected displays: opens/closes/moves as needed. Called on config changes AND on every
 *  display-added/display-removed, so plugging in a projector sends output there automatically and
 *  unplugging it closes that window, with no manual re-assignment required. */
function syncOutputWindows() {
  const configs = store.get('outputConfigs');
  const configById = new Map(configs.map((c) => [c.id, c]));
  const targets = resolveOutputTargets(configs);

  for (const [id, win] of outputWindows) {
    const config = configById.get(id);
    const target = targets.get(id);
    const current = outputWindowTargets.get(id);
    const wantedKey = target !== undefined && config ? windowTargetKey(config, target) : undefined;
    // No longer wanted, moved to a different display, or an NDI toggle flipped its visibility.
    // win.close() is async, so the map is updated here too — otherwise the create pass below would
    // still see this (closing) window as "already open" and skip reopening it on the new target.
    if (wantedKey !== current) {
      win.close();
      outputWindows.delete(id);
      outputWindowTargets.delete(id);
    }
  }
  for (const config of configs) {
    const target = targets.get(config.id);
    if (target !== undefined && !outputWindows.has(config.id)) {
      createOutputWindow(config, target);
    }
  }
  notifyOutputStatus();
  void syncNdiSender();
}

/** Starts/stops the NDI sender to track the 'stream' output's own enabled/ndiEnabled flags and the
 *  existence of its window — called after every syncOutputWindows so it always reflects current
 *  settings, whether they changed via Settings → Outputs or the output window itself just closed. */
function syncNdiSender() {
  const configs = store.get('outputConfigs');
  const streamConfig = configs.find((c) => c.role === 'stream');
  const win = streamConfig ? outputWindows.get(streamConfig.id) : undefined;
  if (streamConfig?.enabled && streamConfig.ndiEnabled && win) {
    return startNdiSender(win, `Sanctuary — ${streamConfig.name}`);
  }
  return stopNdiSender();
}

app.whenReady().then(() => {
  createControlWindow();
  syncOutputWindows();
  startStreamEmbedServer();

  // Projector/monitor plugged or unplugged — re-run the same reconciliation Settings → Outputs
  // triggers, so program/stage outputs auto-claim a newly connected display (or let go of one
  // that just disappeared) without the user touching anything.
  screen.on('display-added', syncOutputWindows);
  screen.on('display-removed', syncOutputWindows);

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

app.on('before-quit', () => {
  void stopNdiSender();
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
ipcMain.handle(Channels.SaveLogoMediaId, (_e, logoMediaId: string | null) => {
  store.set('logoMediaId', logoMediaId);
  return true;
});
ipcMain.handle(Channels.SaveStreamPreviewSource, (_e, source: string | null) => {
  store.set('streamPreviewSource', source);
  return true;
});

ipcMain.handle(Channels.PickMediaFiles, async () => {
  if (!controlWindow) return { items: [], warnings: [] };
  const result = await dialog.showOpenDialog(controlWindow, {
    title: 'Add media',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] },
      { name: 'Videos', extensions: ['mp4', 'webm', 'mov', 'mkv'] },
    ],
  });
  if (result.canceled) return { items: [], warnings: [] };

  const items: MediaItem[] = [];
  const warnings: string[] = [];

  for (const filePath of result.filePaths) {
    const ext = path.extname(filePath).toLowerCase();
    const isVideo = ['.mp4', '.webm', '.mov', '.mkv'].includes(ext);
    const name = path.basename(filePath);
    let resolvedPath = filePath;

    if (isVideo) {
      // Electron/Chromium only decodes h264/vp8/vp9/av1 — anything else (HEVC above all, the
      // default on iPhone recordings) renders blank with no visual signal. Transcode proactively
      // so a volunteer never has to know or care what codec their phone used.
      const probe = await probeVideoStreams(filePath);
      const mustConvert = needsTranscode(probe);
      console.log(
        `[media-transcode] ${name}: video=${probe.videoCodec ?? '(null)'} profile=${probe.videoProfile ?? '(none)'} pix_fmt=${probe.pixFmt ?? '(none)'} audio=${probe.audioCodec ?? '(none)'} needsTranscode=${mustConvert}`
      );
      if (mustConvert) {
        try {
          resolvedPath = await transcodeToH264(filePath);
          console.log(`[media-transcode] ${name}: converted -> ${resolvedPath}`);
        } catch (err) {
          console.error(`[media-transcode] ${name}: FAILED`, err);
          warnings.push(`${name}: couldn't convert (${probe.videoCodec ?? 'unreadable'}) — ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    items.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      type: isVideo ? 'video' : 'image',
      filePath: pathToFileURL(resolvedPath).href,
      addedAt: Date.now(),
    });
  }

  return { items, warnings };
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
  await startRemoteServer((type: RemoteActionType, itemId?: string) => {
    controlWindow?.webContents.send(Channels.RemoteAction, type, itemId);
  });
  updateRemoteState(lastProgramState);
  return getRemoteStatusWithQr();
});

ipcMain.handle(Channels.RemoteStop, () => {
  stopRemoteServer();
  return true;
});

ipcMain.handle(Channels.RemoteGetStatus, () => getRemoteStatusWithQr());

ipcMain.handle(Channels.RemoteQueueUpdate, (_e, items: RemoteQueueItem[]) => {
  updateRemoteQueue(items);
  return true;
});

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
