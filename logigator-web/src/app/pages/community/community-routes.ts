import { inject } from '@angular/core';
import { Route, Routes } from '@angular/router';
import { markdownSummary } from '@logigator/docs';
import { shareCardUrl } from '../../documents/crawler-image';
import { SiteLinks } from '../../layout/site-links';
import { PageMeta } from '../../seo/seo.service';
import { TranslationKey } from '../../translation/translation-key.model';
import { TranslationService } from '../../translation/translation.service';
import { CommunityBrowsePage } from './community-browse-page';
import { communityBrowseGuard } from './community-browse.guard';
import { communityDocumentJsonLd } from './community-document-json-ld';
import { CommunityDocumentPage } from './community-document-page';
import { communityDocumentGuard } from './community-document.guard';
import { CommunityDocumentService } from './community-document.service';
import { apiKindOf, CommunityRouteData } from './community-kind';
import { profileJsonLd } from './profile-json-ld';
import { ProfileListing } from './profile-listing';
import { ProfilePage } from './profile-page';
import {
  profileGuard,
  profileListingGuard,
  ProfileRouteData
} from './profile.guard';
import { ProfileService } from './profile.service';
import { StargazersPage } from './stargazers-page';
import { stargazersGuard } from './stargazers.guard';

/**
 * Every control on these listings writes a query parameter, and the router's
 * default only re-runs a guard when a *path* parameter changes — so without
 * this a paginator click would rewrite the URL and leave the rows alone.
 */
const ON_QUERY_CHANGE = 'paramsOrQueryParamsChange' as const;

/** The document's own name, for the head of its page. */
const documentName = (): string | null =>
  inject(CommunityDocumentService).document()?.name ?? null;

/**
 * The card a pasted link unfurls as, composed from this document. `null` for a
 * link naming nothing this reader may open, which falls back to the site card —
 * the same way the title falls back to the listing's.
 */
const documentCard = (): string | null => {
  const document = inject(CommunityDocumentService).document();
  return document
    ? shareCardUrl(apiKindOf(document.kind), document.link)
    : null;
};

/**
 * Whether the page may be indexed. Asked of what the guard resolved, because
 * the answer is the document's visibility and not the route's: an unlisted
 * document's page is reached by whoever was handed its link, and its owner's
 * preview of a private one is reached by nobody else — neither belongs in an
 * index, and both are the same URL as the one that does.
 *
 * `noindex` rather than a `robots.txt` rule, which is the only lever that works
 * on a URL arrived at by links: a crawler is never told to skip what it is
 * forbidden to fetch, and a listed-by-URL page is the outcome that prevents.
 */
const documentNoindex = (): boolean =>
  inject(CommunityDocumentService).document()?.visibility !== 'public';

/**
 * Whether the stargazer page exists for the document a guard resolved — the
 * question its body answers (`stargazers-page.ts`), asked of the same resolved
 * document because the head has to agree with it.
 *
 * Only a published document has a list, so the page's other two states are the
 * site's own 404: an unlisted document reached through the link somebody was
 * handed, and a private one reached by its owner. What this gates is what would
 * otherwise name the document on that 404 — a step for its trail and its card
 * for the image, neither of which is in front of the reader.
 */
const stargazersPageExists = (): boolean =>
  inject(CommunityDocumentService).document()?.visibility === 'public';

/**
 * The listing and the document, as the two steps between the home page and a
 * page hanging under a document. `PageMeta.ancestors` cannot express it: the
 * second step's name is stored text rather than a key.
 */
function documentTrail(): readonly { name: string; path: string }[] {
  const document = inject(CommunityDocumentService).document();
  if (!document) return [];

  const links = inject(SiteLinks);
  const translation = inject(TranslationService);
  const isProject = document.kind === 'projects';

  return [
    {
      name: translation.translate(
        isProject
          ? 'pages.community.browse.projectsTitle'
          : 'pages.community.browse.componentsTitle'
      ),
      path: isProject ? links.communityProjects() : links.communityComponents()
    },
    {
      name: document.name,
      path: links.communityDocument(document.kind, document.link)
    }
  ];
}

/**
 * One member's page, four times over. A tab is a route rather than a parameter,
 * so each renders server-side, indexes on its own and carries its own canonical
 * — and the header above them is resolved once, on the parent.
 *
 * The three deeper tabs put their section in the title: four pages competing in
 * a result with the same username is what one title for all of them means.
 */
function profileTab(
  path: string,
  section: ProfileRouteData['profileSection'],
  labelKey: TranslationKey
): Route {
  return {
    path,
    component: ProfileListing,
    canActivate: [profileListingGuard],
    runGuardsAndResolvers: ON_QUERY_CHANGE,
    data: {
      profileSection: section,
      seo: {
        titleKey: 'pages.community.profile.title',
        title: () => {
          const username = inject(ProfileService).profile()?.username;
          if (!username) return null;
          if (!path) return username;
          const translation = inject(TranslationService);
          return translation.translate('pages.community.profile.tabTitle', {
            username,
            section: translation.translate(labelKey)
          });
        },
        description: () => {
          const username = inject(ProfileService).profile()?.username;
          return username
            ? inject(TranslationService).translate(
                'pages.community.profile.metaDescription',
                { username }
              )
            : null;
        },
        jsonLd: profileJsonLd
      } satisfies PageMeta
    } satisfies ProfileRouteData & { seo: PageMeta }
  };
}

/**
 * A browse listing and the two pages under it, for one of the two tables. The
 * tables are symmetric in shape, so the tree is written once and handed which
 * one it is; `communityKind` is route data rather than a path segment a page
 * would have to trust.
 */
function documentRoutes(
  kind: CommunityRouteData['communityKind'],
  titleKey: TranslationKey,
  ledeKey: TranslationKey
): Routes {
  const listingPath = `/community/${kind}`;

  return [
    {
      path: `community/${kind}`,
      component: CommunityBrowsePage,
      canActivate: [communityBrowseGuard],
      runGuardsAndResolvers: ON_QUERY_CHANGE,
      data: {
        communityKind: kind,
        seo: { titleKey, descriptionKey: ledeKey } satisfies PageMeta
      } satisfies CommunityRouteData & { seo: PageMeta }
    },
    {
      path: `community/${kind}/:link`,
      component: CommunityDocumentPage,
      canActivate: [communityDocumentGuard],
      data: {
        communityKind: kind,
        seo: {
          // The fallback for a link naming nothing this reader may open: the
          // head then says which listing the reader is on rather than naming a
          // document that is not there.
          titleKey,
          title: documentName,
          // Flattened and cut: the description is markdown, and none of the
          // three tags this feeds renders any. Untruncated it was the whole
          // 2048 characters, asterisks included, in a crawler's snippet.
          description: () =>
            markdownSummary(
              inject(CommunityDocumentService).document()?.description ?? ''
            ),
          image: documentCard,
          noindex: documentNoindex,
          jsonLd: communityDocumentJsonLd,
          ancestors: [{ titleKey, path: listingPath }]
        } satisfies PageMeta
      } satisfies CommunityRouteData & { seo: PageMeta }
    },
    {
      // A sibling of the document, not a child: the two are separate pages, and
      // a child would draw the list underneath the whole detail page.
      path: `community/${kind}/:link/stargazers`,
      component: StargazersPage,
      // The document too, which is what gives this page its heading and trail.
      canActivate: [communityDocumentGuard, stargazersGuard],
      runGuardsAndResolvers: ON_QUERY_CHANGE,
      data: {
        communityKind: kind,
        seo: {
          titleKey: 'pages.community.stargazers.title',
          // The page is about the document, so it unfurls as it: a list of
          // usernames under the site card would say nothing about which one.
          // Both this and the trail go quiet where the page is the 404 rather
          // than that list, for the reason `stargazersPageExists` gives.
          image: () => (stargazersPageExists() ? documentCard() : null),
          // No `noindex` here, though the document's own page needs one: there
          // the same URL renders in three states and two of them are pages that
          // name the document, while here the two states it was added for are
          // now the site's 404 — and a 404 is already no index entry, which is
          // what the catch-all 404 route relies on as well.
          trail: () => (stargazersPageExists() ? documentTrail() : [])
        } satisfies PageMeta
      } satisfies CommunityRouteData & { seo: PageMeta }
    }
  ];
}

/**
 * The community: what it published, one document's own page, who starred it,
 * and who made it.
 *
 * Documents are addressed by their share link rather than by their id, the way
 * the API addresses them — the token *is* the address, so regenerating it takes
 * the public page down with it, which is what revoking a share has to mean.
 */
export const communityRoutes: Routes = [
  // The bar's Community entry points at the projects listing, so a bare
  // `/community` is a URL somebody types rather than one the site emits.
  { path: 'community', pathMatch: 'full', redirectTo: 'community/projects' },
  ...documentRoutes(
    'projects',
    'pages.community.browse.projectsTitle',
    'pages.community.browse.projectsLede'
  ),
  ...documentRoutes(
    'components',
    'pages.community.browse.componentsTitle',
    'pages.community.browse.componentsLede'
  ),
  {
    path: 'community/users/:id',
    component: ProfilePage,
    canActivate: [profileGuard],
    children: [
      profileTab('', 'projects', 'pages.community.profile.projects'),
      profileTab(
        'components',
        'components',
        'pages.community.profile.components'
      ),
      profileTab(
        'starred/projects',
        'starred-projects',
        'pages.community.profile.starredProjects'
      ),
      profileTab(
        'starred/components',
        'starred-components',
        'pages.community.profile.starredComponents'
      )
    ]
  }
];
