import { inject } from '@angular/core';
import { crawlerImageUrl } from '../../documents/crawler-image';
import { SiteLinks } from '../../layout/site-links';
import {
  JsonLdContext,
  JsonLdNode,
  PersonNode,
  ProfilePageNode
} from '../../seo/structured-data';
import { ProfileService } from './profile.service';

/**
 * Who a member is, as data. Two nodes, because "what is this URL" and "who is
 * this" are different questions: the page and the person it is about.
 *
 * Only what the public profile publishes. There is nothing here to leave out —
 * the address, the verification state and the credentials are a different
 * response shape entirely — so no serialization group can be got wrong.
 */
export function profileJsonLd(context: JsonLdContext): JsonLdNode[] {
  const profile = inject(ProfileService).profile();
  if (!profile) return [];

  const links = inject(SiteLinks);
  const profileUrl = `${context.origin}${links.communityUser(profile.id)}`;
  // The avatar's widest rung, absolutized: a crawler resolves against nothing.
  // JPEG, which is the fallback the ladder carries for a photograph.
  const avatarUrl = crawlerImageUrl(profile.avatar, 'jpeg');
  const avatar = avatarUrl ? context.absolute(avatarUrl) : null;

  const person: PersonNode = {
    '@type': 'Person',
    '@id': `${profileUrl}#person`,
    name: profile.username,
    url: profileUrl,
    ...(avatar ? { image: avatar } : {})
  };

  const page: ProfilePageNode = {
    '@type': 'ProfilePage',
    // The tab's own URL, so the four are four pages rather than one described
    // four times — which is the reason they are four routes.
    '@id': `${context.url}#profile`,
    url: context.url,
    name: profile.username,
    dateCreated: profile.memberSince,
    mainEntity: person,
    isPartOf: { '@id': context.siteId }
  };

  return [page];
}
