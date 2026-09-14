import { contextBridge, ipcRenderer } from 'electron';
import { Channels } from './ipcChannels';
import type { ControlApi } from '@shared/api';

const api: ControlApi = {
  library: {
    get: () => ipcRenderer.invoke(Channels.GetLibrary),
    saveSongs: (songs) => ipcRenderer.invoke(Channels.SaveSongs, songs),
    saveMedia: (media) => ipcRenderer.invoke(Channels.SaveMedia, media),
    savePlaylists: (playlists) => ipcRenderer.invoke(Channels.SavePlaylists, playlists),
    saveTemplates: (templates) => ipcRenderer.invoke(Channels.SaveTemplates, templates),
    savePresentations: (presentations) => ipcRenderer.invoke(Channels.SavePresentations, presentations),
    saveOutputConfigs: (configs) => ipcRenderer.invoke(Channels.SaveOutputConfigs, configs),
    saveLogoMediaId: (mediaId) => ipcRenderer.invoke(Channels.SaveLogoMediaId, mediaId),
    saveStreamPreviewSource: (source) => ipcRenderer.invoke(Channels.SaveStreamPreviewSource, source),
  },
  dialogs: {
    pickMediaFiles: () => ipcRenderer.invoke(Channels.PickMediaFiles),
  },
  songs: {
    importFiles: () => ipcRenderer.invoke(Channels.ImportSongsFiles),
    importFolder: () => ipcRenderer.invoke(Channels.ImportSongsFolder),
    importEasyWorship: () => ipcRenderer.invoke(Channels.ImportEasyWorshipDatabase),
  },
  presentations: {
    import: () => ipcRenderer.invoke(Channels.ImportPresentation),
  },
  live: {
    goLive: (state) => ipcRenderer.invoke(Channels.GoLive, state),
    clear: () => ipcRenderer.invoke(Channels.ClearLive),
  },
  displays: {
    list: () => ipcRenderer.invoke(Channels.ListDisplays),
    sync: () => ipcRenderer.invoke(Channels.SyncOutputWindows),
    getStatus: () => ipcRenderer.invoke(Channels.GetOutputStatus),
    onStatus: (cb) => {
      const listener = (_e: unknown, statuses: Parameters<typeof cb>[0]) => cb(statuses);
      ipcRenderer.on(Channels.OutputWindowStatus, listener);
      return () => ipcRenderer.removeListener(Channels.OutputWindowStatus, listener);
    },
  },
  bible: {
    getTranslations: () => ipcRenderer.invoke(Channels.BibleGetTranslations),
    getBooks: (translationCode) => ipcRenderer.invoke(Channels.BibleGetBooks, translationCode),
    getChapterCount: (translationCode, book) => ipcRenderer.invoke(Channels.BibleGetChapterCount, translationCode, book),
    getChapterVerses: (translationCode, book, chapter) =>
      ipcRenderer.invoke(Channels.BibleGetChapterVerses, translationCode, book, chapter),
    search: (translationCode, query) => ipcRenderer.invoke(Channels.BibleSearch, translationCode, query),
  },
  remote: {
    start: () => ipcRenderer.invoke(Channels.RemoteStart),
    stop: () => ipcRenderer.invoke(Channels.RemoteStop),
    getStatus: () => ipcRenderer.invoke(Channels.RemoteGetStatus),
    onAction: (cb) => {
      const listener = (_e: unknown, type: Parameters<typeof cb>[0], itemId?: string) => cb(type, itemId);
      ipcRenderer.on(Channels.RemoteAction, listener);
      return () => ipcRenderer.removeListener(Channels.RemoteAction, listener);
    },
    pushQueue: (items) => ipcRenderer.invoke(Channels.RemoteQueueUpdate, items),
  },
};

contextBridge.exposeInMainWorld('api', api);
