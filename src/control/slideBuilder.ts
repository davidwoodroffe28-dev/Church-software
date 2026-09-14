import type { Background, LibraryData, LiveSlide, Playlist, PlaylistItem, Template } from '@shared/types';

const FALLBACK_TEMPLATE: Template = {
  id: 'fallback',
  name: 'Fallback',
  background: { type: 'color', value: '#000000' },
  fontFamily: 'sans-serif',
  fontSize: 56,
  textColor: '#ffffff',
  textAlign: 'center',
  lowerThird: false,
};

function templateFor(id: string | undefined, library: LibraryData, fallbackId: string): Template {
  return library.templates.find((t) => t.id === id) ?? library.templates.find((t) => t.id === fallbackId) ?? FALLBACK_TEMPLATE;
}

/** Number of clickable sub-slides within a playlist item (song sections, presentation pages, etc). */
export function getSubSlideCount(item: PlaylistItem, library: LibraryData): number {
  switch (item.type) {
    case 'song': {
      const song = library.songs.find((s) => s.id === item.refId);
      if (!song) return 1;
      return (song.sequence.length || song.sections.length) || 1;
    }
    case 'presentation': {
      const presentation = library.presentations.find((p) => p.id === item.presentationId);
      return Math.max(1, presentation?.slideCount ?? 1);
    }
    default:
      return 1;
  }
}

export function buildLiveSlide(item: PlaylistItem, subIndex: number, library: LibraryData): LiveSlide {
  switch (item.type) {
    case 'song': {
      const song = library.songs.find((s) => s.id === item.refId);
      if (!song) return { kind: 'blank' };
      const order = song.sequence.length ? song.sequence : song.sections.map((s) => s.id);
      const sectionId = order[Math.min(subIndex, order.length - 1)];
      const section = song.sections.find((s) => s.id === sectionId) ?? song.sections[0];
      const template = templateFor(item.templateId ?? song.templateId, library, 'default-lyrics');
      return {
        kind: 'song',
        text: section?.text ?? '',
        secondaryText: section?.secondaryText,
        label: `${song.title} — ${section?.label ?? ''}`,
        background: template.background,
        template,
      };
    }
    case 'verse': {
      if (!item.bible) return { kind: 'blank' };
      const template = templateFor(item.templateId, library, 'default-verse');
      const ref =
        item.bible.verseEnd && item.bible.verseEnd !== item.bible.verseStart
          ? `${item.bible.book} ${item.bible.chapter}:${item.bible.verseStart}-${item.bible.verseEnd}`
          : `${item.bible.book} ${item.bible.chapter}:${item.bible.verseStart}`;
      return {
        kind: 'verse',
        text: item.bible.text,
        label: `${ref} (${item.bible.translation})`,
        background: template.background,
        template,
      };
    }
    case 'media': {
      const media = library.media.find((m) => m.id === item.refId);
      if (!media) return { kind: 'blank' };
      return {
        kind: 'media',
        label: media.name,
        background: { type: media.type, value: media.filePath },
      };
    }
    case 'lowerThird': {
      const template = templateFor(item.templateId, library, 'default-lower-third');
      return {
        kind: 'lowerThird',
        text: item.customText ?? '',
        label: item.label,
        background: template.background,
        template,
      };
    }
    case 'presentation': {
      const presentation = library.presentations.find((p) => p.id === item.presentationId);
      if (!presentation) return { kind: 'blank' };
      const index = Math.min(subIndex, Math.max(0, presentation.slideCount - 1));
      const pageNumber = index + 1;
      if (presentation.mode === 'native') {
        return {
          kind: 'presentation',
          label: `${presentation.name} — Slide ${pageNumber}`,
          nativeSlide: presentation.nativeSlides?.[index],
          pageNumber,
          pageCount: presentation.slideCount,
        };
      }
      return {
        kind: 'presentation',
        label: `${presentation.name} — Slide ${pageNumber}`,
        pdfPath: presentation.pdfPath,
        pageNumber,
        pageCount: presentation.slideCount,
      };
    }
    default:
      return { kind: 'blank' };
  }
}

/** The "up next" slide after the given live position — the next sub-slide within the current item,
 *  or the first sub-slide of the following service item once the current one runs out. Shared by the
 *  program-state broadcast (sendProgramState) and the Stage screen's own "NEXT" preview. */
export function getNextSlide(
  playlist: Playlist | null,
  liveItemId: string | null,
  liveSubIndex: number,
  library: LibraryData
): LiveSlide | undefined {
  const item = playlist?.items.find((i) => i.id === liveItemId) ?? null;
  if (!item || !playlist) return undefined;
  const subCount = getSubSlideCount(item, library);
  if (liveSubIndex + 1 < subCount) return buildLiveSlide(item, liveSubIndex + 1, library);
  const idx = playlist.items.findIndex((i) => i.id === item.id);
  const nextItem = playlist.items[idx + 1];
  return nextItem ? buildLiveSlide(nextItem, 0, library) : undefined;
}

/** Layers the operator's directly-picked background (Backgrounds tab) over a text-kind slide's own
 *  template background — a no-op for anything else (full-frame media/presentation ARE their own
 *  visual, blank has nothing to layer onto, a countdown isn't a backdrop-behind-text situation). This
 *  is what makes a background independent of the service: it applies to whatever song/verse/lower-
 *  third happens to be live, without needing to be attached to that item or its theme first. */
export function applyBackgroundOverride(slide: LiveSlide, override: Background | null): LiveSlide {
  if (!override) return slide;
  // Blank counts too — with nothing staged/live yet, a picked background should still show up as
  // an ambient backdrop rather than silently doing nothing until some text happens to go live.
  if (slide.kind !== 'song' && slide.kind !== 'verse' && slide.kind !== 'lowerThird' && slide.kind !== 'blank') {
    return slide;
  }
  return { ...slide, background: override };
}
