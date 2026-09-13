import { contextBridge, ipcRenderer } from 'electron';
import { Channels } from './ipcChannels';
import type { OutputApi } from '@shared/api';

const outputApi: OutputApi = {
  onProgramState: (cb) => {
    const listener = (_e: unknown, state: Parameters<typeof cb>[0]) => cb(state);
    ipcRenderer.on(Channels.ProgramStateUpdate, listener);
    return () => ipcRenderer.removeListener(Channels.ProgramStateUpdate, listener);
  },
};

contextBridge.exposeInMainWorld('outputApi', outputApi);
