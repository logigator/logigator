import type { LanguageId } from '@logigator/core';
import posterEn from '../../../assets/video-poster-en.webp';
import posterDe from '../../../assets/video-poster-de.webp';

export interface HomeVideo {
  id: string;
  /** The video's own title on YouTube, in the language it is narrated in. */
  title: string;
  duration: string;
  /** Self-hosted, so no third party is contacted before the visitor clicks. */
  poster: string;
}

/** The explainer per narration language; anything but German gets English. */
const VIDEOS: Record<'en' | 'de', HomeVideo> = {
  en: {
    id: 'weTeJLMGq_Q',
    title: 'Logic Gates — Explained',
    duration: '3:34',
    poster: posterEn
  },
  de: {
    id: '114EOH-fdLE',
    title: 'Logische Gatter — Erklärt',
    duration: '3:37',
    poster: posterDe
  }
};

export function homeVideo(lang: LanguageId): HomeVideo {
  return lang === 'de' ? VIDEOS.de : VIDEOS.en;
}
