import type { ControlApi, OutputApi } from '@shared/api';

export {};

declare global {
  interface Window {
    api: ControlApi;
    outputApi: OutputApi;
  }
}
