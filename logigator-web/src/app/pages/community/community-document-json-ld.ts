import { inject } from '@angular/core';
import { crawlerPreviewUrl } from '../../documents/crawler-image';
import { SiteLinks } from '../../layout/site-links';
import {
  CreativeWorkNode,
  JsonLdContext,
  JsonLdNode,
  PersonNode
} from '../../seo/structured-data';
import { CommunityDocumentService } from './community-document.service';

/**
 * What a published circuit is, as data: who made it, when, what it looks like,
 * how many people starred it, and — where it is a fork — what it was built on.
 *
 * This is the first node the site emits over stored text, which is what the
 * serializer's `<` escaping exists for: a circuit name or a username carrying
 * `</script>` would otherwise end the block and turn stored text into markup.
 *
 * Nothing here is emitted for a page whose read found nothing or failed: the
 * head then falls back to the page's own keys, and a graph describing a
 * document that is not on the page would be a lie a crawler acts on.
 */
export function communityDocumentJsonLd(context: JsonLdContext): JsonLdNode[] {
  const document = inject(CommunityDocumentService).document();
  if (!document) return [];

  const links = inject(SiteLinks);
  const authorUrl = `${context.origin}${links.communityUser(document.author.id)}`;
  const author: PersonNode = {
    '@type': 'Person',
    '@id': `${authorUrl}#person`,
    name: document.author.username,
    url: authorUrl
  };

  const preview = crawlerPreviewUrl(document.preview);
  // The parent is named even where it is no longer public: withholding the
  // credit because somebody unpublished would turn a fork into original work.
  const parent = document.forkedFrom;

  const work: CreativeWorkNode = {
    '@type': 'CreativeWork',
    '@id': `${context.url}#circuit`,
    name: document.name,
    url: context.url,
    author,
    dateCreated: document.createdAt,
    dateModified: document.lastEditedAt,
    isPartOf: { '@id': context.siteId },
    ...(document.description ? { description: document.description } : {}),
    ...(preview ? { image: context.absolute(preview) } : {}),
    ...(parent
      ? {
          isBasedOn: {
            '@type': 'CreativeWork' as const,
            name: parent.name,
            url: `${context.origin}${links.communityDocument(document.kind, parent.link)}`
          }
        }
      : {}),
    // The vocabulary's own shape for "this many people did this to it", so a
    // consumer reads the tally without knowing what a star is here. Omitted at
    // zero: a counter of nothing is noise, not a fact.
    ...(document.stars > 0
      ? {
          interactionStatistic: {
            '@type': 'InteractionCounter' as const,
            interactionType: 'https://schema.org/LikeAction',
            userInteractionCount: document.stars
          }
        }
      : {})
  };

  return [author, work];
}
