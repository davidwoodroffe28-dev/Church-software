// Centralized IPC channel names shared between main and preload scripts.
export const Channels = {
  // Library CRUD (invoked from control window, handled in main)
  GetLibrary: 'library:get',
  SaveSongs: 'library:saveSongs',
  SaveMedia: 'library:saveMedia',
  SavePlaylists: 'library:savePlaylists',
  SaveTemplates: 'library:saveTemplates',
  SavePresentations: 'library:savePresentations',
  SaveOutputConfigs: 'library:saveOutputConfigs',

  // File dialogs
  PickMediaFiles: 'dialog:pickMediaFiles',
  ImportPresentation: 'presentation:import',
  ImportSongsFiles: 'songs:importFiles',
  ImportSongsFolder: 'songs:importFolder',
  ImportEasyWorshipDatabase: 'songs:importEasyWorship',

  // Live output control (control window -> main -> all output windows)
  GoLive: 'live:go',
  ClearLive: 'live:clear',
  // main -> output window
  ProgramStateUpdate: 'live:programStateUpdate',

  // Output window management (program / stage / stream)
  ListDisplays: 'displays:list',
  SyncOutputWindows: 'outputs:sync',
  GetOutputStatus: 'outputs:getStatus',
  OutputWindowStatus: 'outputs:status',

  // Bible lookup (bundled multi-translation dataset, see resources/bible/)
  BibleGetTranslations: 'bible:getTranslations',
  BibleGetBooks: 'bible:getBooks',
  BibleSearch: 'bible:search',
} as const;
