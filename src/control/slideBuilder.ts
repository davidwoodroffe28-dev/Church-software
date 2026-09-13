import type { LibraryData, LiveSlide, PlaylistItem, Template } from '@shared/types';

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
