import { environment } from '../../../environments/environment';
import {
  isoDuration,
  JsonLdContext,
  JsonLdNode,
  jsonLdIds,
  SoftwareApplicationNode,
  VideoObjectNode
} from '../../seo/structured-data';
import { homeVideo, videoEmbedUrl } from './home-video';
import heroLight from '../../../assets/hero-board-light.webp';

/**
 * What the home page is: the front of the editor, plus the explainer it embeds.
 *
 * The application node is the page's reason to exist — a crawler asking "what
 * is this site for" gets the answer as data rather than having to read the
 * hero. Its `url` is the editor's own, since that is the thing being described;
 * the page is only where it is announced.
 *
 * The light hero is the `image` in every language and both schemes: the two
 * renders are the same circuit, and a crawler has no scheme to prefer.
 */
export function homeJsonLd(context: JsonLdContext): JsonLdNode[] {
  const ids = jsonLdIds(context.origin);
  const video = homeVideo(context.lang);
  const duration = isoDuration(video.duration);

  const application: SoftwareApplicationNode = {
    '@type': ['SoftwareApplication', 'WebApplication'],
    '@id': ids.editor,
    name: context.translate('site.name'),
    url: `${context.origin}${environment.editorUrl}`,
    description: context.translate('site.description'),
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Web browser',
    inLanguage: context.lang,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    image: context.absolute(heroLight),
    isPartOf: { '@id': context.siteId }
  };

  const explainer: VideoObjectNode = {
    '@type': 'VideoObject',
    name: video.title,
    description: context.translate('pages.home.video.description'),
    thumbnailUrl: context.absolute(video.poster),
    embedUrl: videoEmbedUrl(video),
    inLanguage: video.language,
    // Both are absent rather than empty when unknown: a property carrying no
    // value is worse than one a consumer never sees.
    ...(duration ? { duration } : {}),
    ...(video.uploadDate ? { uploadDate: video.uploadDate } : {})
  };

  return [application, explainer];
}
