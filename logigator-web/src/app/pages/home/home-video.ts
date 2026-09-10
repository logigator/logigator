import type { LanguageId } from '@logigator/core';
import posterEn from '../../../assets/video-poster-en.webp';
import posterDe from '../../../assets/video-poster-de.webp';

export interface HomeVideo {
  id: string;
  /** The language it is narrated in, which is not always the page's. */
  language: 'en' | 'de';
  /** The video's own title on YouTube, in the language it is narrated in. */
  title: string;
  /** As it reads on YouTube; `isoDuration` derives the schema.org form. */
  duration: string;
  /**
   * ISO 8601 date the video was published, for the `VideoObject` a page
   * embedding it emits. Google's video result wants it and the site has no way
   * to derive it, so it is read off YouTube the way the duration was — absent
   * until someone does, never guessed.
   */
  uploadDate?: string;
  /** Self-hosted, so no third party is contacted before the visitor clicks. */
  poster: string;
}

/** The explainer per narration language; anything but German gets English. */
const VIDEOS: Record<'en' | 'de', HomeVideo> = {
  en: {
    id: 'weTeJLMGq_Q',
    language: 'en',
    title: 'Logic Gates — Explained',
    duration: '3:34',
    poster: posterEn
  },
  de: {
    id: '114EOH-fdLE',
    language: 'de',
    title: 'Logische Gatter — Erklärt',
    duration: '3:37',
    poster: posterDe
  }
};

export function homeVideo(lang: LanguageId): HomeVideo {
  return lang === 'de' ? VIDEOS.de : VIDEOS.en;
}

/**
 * Where the video plays, on the host that sets no cookie until it does. The
 * player and the `VideoObject` describing it both name this, so the host lives
 * here rather than in each of them.
 */
export function videoEmbedUrl(video: HomeVideo): string {
  return `https://www.youtube-nocookie.com/embed/${video.id}`;
}
