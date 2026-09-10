import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { communityRow } from '../../../testing/community-rows';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { TranslationService } from '../../translation/translation.service';
import { PageMeta, SeoService } from '../../seo/seo.service';
import { SITE_ORIGIN } from '../../seo/site-origin';
import { JsonLdNode } from '../../seo/structured-data';
import { communityDocumentJsonLd } from './community-document-json-ld';
import { CommunityDocumentService } from './community-document.service';
import { profileJsonLd } from './profile-json-ld';
import { ProfileService } from './profile.service';

const ORIGIN = 'https://logigator.com';
const LINK = '11111111-1111-4111-8111-111111111111';
const PARENT_LINK = '22222222-2222-4222-8222-222222222222';
const USER = '33333333-3333-4333-8333-333333333333';
const DETAIL_URL = `/api/community/projects/${LINK}`;
const PROFILE_URL = `/api/community/users/${USER}`;

type Node = JsonLdNode & Record<string, unknown>;

/** The one graph in the head, as the objects a consumer would read. */
function graph(): Node[] {
  const scripts = document.head.querySelectorAll(
    'script[type="application/ld+json"]'
  );
  expect(scripts).toHaveLength(1);
  return (JSON.parse(scripts[0].textContent ?? '') as { '@graph': Node[] })[
    '@graph'
  ];
}

function node(type: string): Node | undefined {
  return graph().find((entry) => entry['@type'] === type);
}

describe('the community pages’ JSON-LD', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    configureTestBed([{ provide: SITE_ORIGIN, useValue: ORIGIN }]);
    http = TestBed.inject(HttpTestingController);
    for (const tag of document.head.querySelectorAll(
      'script[type="application/ld+json"]'
    )) {
      tag.remove();
    }
  });

  async function resolveDocument(patch = {}, forkedFrom = null): Promise<void> {
    const content = TestBed.inject(CommunityDocumentService);
    const resolved = content.resolve('projects', LINK);
    http
      .expectOne(DETAIL_URL)
      .flush({ ...communityRow('Half adder', LINK, patch), forkedFrom });
    await resolved;
  }

  function apply(page: PageMeta, path: string): void {
    TestBed.inject(SeoService).apply(page, path);
  }

  const documentPage: PageMeta = {
    titleKey: 'pages.community.browse.projectsTitle',
    title: () =>
      TestBed.inject(CommunityDocumentService).document()?.name ?? null,
    jsonLd: communityDocumentJsonLd
  };

  it('describes the document a guard resolved, not the route’s own data', async () => {
    // The factory runs after the guards and inside an injection context, which
    // is the whole reason a page can describe what it actually rendered.
    await resolveDocument({ stars: 214 });
    apply(documentPage, `/en/community/projects/${LINK}`);

    expect(node('CreativeWork')).toMatchObject({
      name: 'Half adder',
      url: `${ORIGIN}/en/community/projects/${LINK}`,
      dateCreated: '2026-01-01T00:00:00.000Z',
      dateModified: '2026-01-01T00:00:00.000Z',
      author: {
        '@type': 'Person',
        url: `${ORIGIN}/en/community/users/${USER}`
      },
      interactionStatistic: { userInteractionCount: 214 }
    });
  });

  it('leaves out a tally of nothing rather than emitting a zero', async () => {
    await resolveDocument({ stars: 0 });
    apply(documentPage, `/en/community/projects/${LINK}`);

    expect(node('CreativeWork')).not.toHaveProperty('interactionStatistic');
  });

  it('names the parent a fork was built on', async () => {
    await resolveDocument({}, {
      id: PARENT_LINK,
      name: 'Adder',
      link: PARENT_LINK,
      authorName: 'ada'
    } as never);
    apply(documentPage, `/en/community/projects/${LINK}`);

    expect(node('CreativeWork')?.['isBasedOn']).toMatchObject({
      name: 'Adder',
      url: `${ORIGIN}/en/community/projects/${PARENT_LINK}`
    });
  });

  it('describes nothing for a link that named nothing published', async () => {
    const content = TestBed.inject(CommunityDocumentService);
    const resolved = content.resolve('projects', LINK);
    http
      .expectOne(DETAIL_URL)
      .flush(
        { code: 'not_found', message: 'No such published document.' },
        { status: 404, statusText: 'Not Found' }
      );
    await resolved;

    await TestBed.inject(TranslationService).setActiveLang('en');
    apply(documentPage, `/en/community/projects/${LINK}`);

    // A graph describing a document that is not on the page is a lie a crawler
    // acts on; and the head falls back to the page's own key.
    expect(node('CreativeWork')).toBeUndefined();
    expect(document.title).toContain('Community Projects');
  });

  it('cannot be ended early by a circuit name that closes the script tag', async () => {
    // The first stored text the graph carries. Without the serializer's escape
    // this name would end the block and turn stored text into markup.
    await resolveDocument({ name: 'Adder</script><script>alert(1)</script>' });
    apply(documentPage, `/en/community/projects/${LINK}`);

    const script = document.head.querySelector(
      'script[type="application/ld+json"]'
    );
    expect(script?.textContent).not.toContain('</script>');
    expect(node('CreativeWork')?.['name']).toBe(
      'Adder</script><script>alert(1)</script>'
    );
  });

  it('describes a member’s page and the member as two nodes', async () => {
    const content = TestBed.inject(ProfileService);
    const resolved = content.resolveProfile(USER);
    http.expectOne(PROFILE_URL).flush({
      id: USER,
      username: 'marek_h',
      avatar: null,
      memberSince: '2024-03-09T00:00:00.000Z',
      publicProjects: 4,
      publicComponents: 2
    });
    await resolved;

    apply(
      {
        titleKey: 'pages.community.profile.title',
        jsonLd: profileJsonLd
      },
      `/en/community/users/${USER}/components`
    );

    expect(node('ProfilePage')).toMatchObject({
      // The tab's own URL: the four tabs are four pages, not one described four
      // times over.
      url: `${ORIGIN}/en/community/users/${USER}/components`,
      dateCreated: '2024-03-09T00:00:00.000Z',
      mainEntity: {
        '@type': 'Person',
        name: 'marek_h',
        url: `${ORIGIN}/en/community/users/${USER}`
      }
    });
  });
});
