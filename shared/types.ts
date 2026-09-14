// Shared types used by both the main (Electron) process and the renderer UIs.
// Type-only — safe to import from either side without pulling runtime code across the boundary.

export type BackgroundType = 'color' | 'image' | 'video';

export interface Background {
  type: BackgroundType;
  /** Hex color for type 'color', or an absolute file path / file:// URL for 'image'/'video'. */
  value: string;
}

export interface Template {
  id: string;
  name: string;
  background: Background;
  fontFamily: string;
  fontSize: number;
  textColor: string;
  textAlign: 'left' | 'center' | 'right';
  /** Renders text pinned to the bottom third of the screen with a translucent bar, EasyWorship-style. */
  lowerThird: boolean;
  /** When true, a section's secondaryText (if any) renders stacked below the primary line — for
   *  multicultural/multilingual congregations projecting two languages at once. */
  showSecondaryLanguage?: boolean;
}

export interface SongSection {
  id: string;
  /** e.g. "Verse 1", "Chorus", "Bridge" */
  label: string;
  text: string;
  /** A second language's rendering of the same section (e.g. a Spanish translation), shown stacked
   *  below `text` when the active Template has showSecondaryLanguage on. Optional — most songs and
   *  most churches never set this. */
  secondaryText?: string;
}

export interface Song {
  id: string;
  title: string;
  author?: string;
  sections: SongSection[];
  /** Order in which section ids should be presented; defaults to sections order if empty. */
  sequence: string[];
  templateId?: string;
  createdAt: number;
  updatedAt: number;
  /** Starred for quick access in the Library — independent of how recently it was used. */
  favorite?: boolean;
  /** Set whenever the song is added to a service, for "recently used" sorting in the Library —
   *  distinct from updatedAt, which tracks edits to the song's own content. */
  lastUsedAt?: number;
}

export type MediaType = 'image' | 'video';

export interface MediaItem {
  id: string;
  name: string;
  type: MediaType;
  filePath: string;
  addedAt: number;
}

export interface BibleVerse {
  book: string;
  chapter: number;
  verse: number;
  text: string;
}

export interface BibleReference {
  translation: string;
  book: string;
  chapter: number;
  verseStart: number;
  verseEnd?: number;
}

export interface NativeTextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  /** Font size as a percentage of slide height (resolution-independent; render with CSS container query units). */
  fontSizePct?: number;
  color?: string;
}

export interface NativeTextBox {
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
  align: 'left' | 'center' | 'right';
  paragraphs: { runs: NativeTextRun[] }[];
}

export interface NativeSlide {
  backgroundColor?: string;
  /** data: URI */
  backgroundImage?: string;
  textBoxes: NativeTextBox[];
}

export interface Presentation {
  id: string;
  name: string;
  /** Original .pptx/.ppt file the user imported */
  sourceFilePath: string;
  /** 'pdf': converted via a locally installed LibreOffice, rendered pixel-accurately with pdf.js.
   *  'native': parsed directly from the .pptx XML with no external dependency — approximate layout
   *  and fonts (no master/layout inheritance, no effects/animations), used automatically as a
   *  fallback when LibreOffice isn't available. */
  mode: 'pdf' | 'native';
  pdfPath?: string;
  nativeSlides?: NativeSlide[];
  slideCount: number;
  addedAt: number;
}

export type PlaylistItemType = 'song' | 'verse' | 'media' | 'lowerThird' | 'presentation';

export interface PlaylistItem {
  id: string;
  type: PlaylistItemType;
  /** id of the Song / MediaItem this references, when applicable */
  refId?: string;
  /** For 'verse' items: the resolved reference + text snapshot */
  bible?: BibleReference & { text: string };
  /** For 'lowerThird' items: free-form text (e.g. announcement, name/title) */
  customText?: string;
  /** For 'presentation' items */
  presentationId?: string;
  slideIndex?: number;
  templateId?: string;
  label: string;
  /** Marked for the pre-service auto-advance loop (announcements/media cycling on Program before
   *  the service starts) — see AppState.preServiceLoop in the control store. */
  loopSlide?: boolean;
}

export interface Playlist {
  id: string;
  name: string;
  items: PlaylistItem[];
  createdAt: number;
  updatedAt: number;
}

/** What is currently being shown on a live output window. */
export interface LiveSlide {
  kind: 'blank' | 'song' | 'verse' | 'media' | 'lowerThird' | 'presentation' | 'countdown';
  text?: string;
  /** A second language's rendering of `text`, shown stacked below it when the template's
   *  showSecondaryLanguage is on — see SongSection.secondaryText. */
  secondaryText?: string;
  label?: string;
  background?: Background;
  template?: Template;
  /** For kind 'presentation' (mode 'pdf'): rendered client-side from this PDF page via pdf.js */
  pdfPath?: string;
  pageNumber?: number;
  pageCount?: number;
  /** For kind 'presentation' (mode 'native'): pre-parsed slide content, rendered as absolutely
   *  positioned HTML/CSS instead of a PDF page. */
  nativeSlide?: NativeSlide;
  /** For kind 'countdown', while running: an absolute timestamp (Date.now()-compatible ms) the
   *  output window ticks down to locally — broadcasting the end time once, rather than a new value
   *  every second, keeps this cheap and perfectly in sync across every output window. */
  countdownEndAt?: number;
  /** For kind 'countdown' while paused: the frozen remaining time to display statically. Exactly
   *  one of countdownEndAt/countdownRemainingSec is set at a time. */
  countdownRemainingSec?: number;
}

/** Broadcast to every output window; each renders it differently based on its role. */
export interface ProgramState {
  current: LiveSlide;
  /** "Up next" preview, shown on the stage display only. */
  next?: LiveSlide;
  /** Free-text operator note shown on the stage display (e.g. "5 min to sermon"). */
  stageMessage?: string;
  /** Show a running clock on the stage display. */
  stageClock?: boolean;
  /** Independent layer visibility, so "Clear Text" can drop the lyric/verse text while a video
   *  background keeps looping, and vice versa. Both default to true when omitted. */
  textVisible?: boolean;
  backgroundVisible?: boolean;
}

export type OutputRole = 'program' | 'stage' | 'stream';

export interface OutputConfig {
  id: string;
  role: OutputRole;
  name: string;
  /** Physical display id to place this output fullscreen on; null = leave as a regular window
   *  (e.g. for OBS/vMix Window Capture of the stream/lower-thirds output). */
  displayId: number | null;
  /** Chroma-key background color used by the 'stream' role so it can be keyed out in OBS/vMix. */
  chromaKey: string;
  enabled: boolean;
}

export interface LibraryData {
  songs: Song[];
  media: MediaItem[];
  playlists: Playlist[];
  templates: Template[];
  presentations: Presentation[];
  outputConfigs: OutputConfig[];
  /** MediaItem id used for the Live screen's "Logo" toggle (Settings → Appearance) — null until set. */
  logoMediaId: string | null;
}
