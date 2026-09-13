import type { PlaylistItemType } from '@shared/types';

/** Fixed hue + label per item type, per DESIGN-SPEC.md §2 ("Item-type stripes"). */
export function itemTypeMeta(type: PlaylistItemType): { color: string; label: string } {
  switch (type) {
    case 'song':
      return { color: 'var(--type-song)', label: 'Song' };
    case 'verse':
      return { color: 'var(--type-scripture)', label: 'Scripture' };
    case 'media':
      return { color: 'var(--type-media)', label: 'Media' };
    case 'presentation':
      return { color: 'var(--type-slides)', label: 'Slides' };
    case 'lowerThird':
      return { color: 'var(--type-slides)', label: 'Lower Third' };
  }
}
