import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import {
  FastifyAdapter,
  type NestFastifyApplication
} from '@nestjs/platform-fastify';
import { AuthGuard } from '../auth/auth.guard';
import { CloneService } from './clone.service';
import { ShareCardService } from './share-card.service';
import { ShareController } from './share.controller';
import { ShareService } from './share.service';

const LINK = '00000000-0000-4000-8000-000000000000';
const ETAG = '"a-composed-card"';

/**
 * The card's conditional-request half, over a stand-in composer: an unfurler
 * re-fetches on a schedule of its own, so answering `304` is what keeps a
 * composed-on-demand card from being composed on every scrape. A revalidating
 * cache may send the tag back marked weak, or several of them, and neither
 * means a different picture — the rest of the route is covered end to end.
 */
/** What a share read answers, with the tally the landing page draws. */
const SHARED = {
  kind: 'project',
  project: { id: LINK, name: 'Half adder', link: LINK },
  document: {
    version: 1,
    name: 'Half adder',
    components: [],
    wires: '',
    definitions: []
  },
  dependencies: [],
  attribution: [],
  author: { id: LINK, username: 'alice', avatar: null },
  stars: 7
};

describe('the share card route', () => {
  let app: NestFastifyApplication;
  const png = Buffer.from('89504e470d0a1a0a', 'hex');
  /**
   * What the stand-in composer answers with. `publiclyReadable` is the one thing
   * about a card the service decides per request, and it is what the route's
   * `Cache-Control` is built from.
   */
  let readable = true;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ShareController],
      providers: [
        {
          provide: ShareService,
          useValue: { read: () => Promise.resolve(SHARED) }
        },
        { provide: CloneService, useValue: {} },
        {
          provide: ShareCardService,
          useValue: {
            forLink: () =>
              Promise.resolve({ etag: ETAG, png, publiclyReadable: readable })
          }
        }
      ]
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter()
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  function card(ifNoneMatch?: string, kind = 'project') {
    return app.inject({
      method: 'GET',
      url: `/share/${kind}/${LINK}/card.png`,
      headers: ifNoneMatch ? { 'if-none-match': ifNoneMatch } : {}
    });
  }

  it('answers the picture with the tag it was composed under', async () => {
    const response = await card();

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('image/png');
    expect(response.headers['etag']).toBe(ETAG);
    expect(response.headers['cache-control']).toBe('public, max-age=300');
    expect(response.rawPayload.equals(png)).toBe(true);
  });

  it.each([ETAG, `W/${ETAG}`, `"other", ${ETAG}`])(
    'answers 304 to %s',
    async (header) => {
      const response = await card(header);

      expect(response.statusCode).toBe(304);
      expect(response.rawPayload.length).toBe(0);
      // Still addressable: a 304 that drops the tag makes the next request
      // unconditional.
      expect(response.headers['etag']).toBe(ETAG);
    }
  );

  it('sends the picture when the tag names another card', async () => {
    const response = await card('"a-different-card"');

    expect(response.statusCode).toBe(200);
  });

  it('does not offer a card nobody else may fetch to a shared cache', async () => {
    // A private document's card is composed for its owner alone, so the answer
    // must not be storable between callers: a cache holding it would hand the
    // picture to exactly the caller the same route answers `404` for.
    readable = false;
    try {
      const response = await card();

      expect(response.statusCode).toBe(200);
      expect(response.headers['cache-control']).toBe('private, no-store');
    } finally {
      readable = true;
    }
  });

  it('answers the read whole, tally included', async () => {
    // The route hands the service's answer back rather than rebuilding it: a
    // controller that picked fields out would drop whatever it was not told
    // about, and the page draws the tally.
    const response = await app.inject({
      method: 'GET',
      url: `/share/project/${LINK}`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(SHARED);
  });

  it.each(['boards', 'PROJECT', 'project/'])(
    'answers 404 for %s, which names no table',
    async (kind) => {
      // The kinds are checked like the token is: a segment that names no table
      // names no document, and answering 404 is both truer than a widened
      // search and quieter than a driver error.
      // The service here answers for any token it is handed, so a 404 is the
      // route turning the request away rather than the document being missing.
      // The error body — which this app does not register a filter for — is
      // asserted end to end.
      const response = await app.inject({
        method: 'GET',
        url: `/share/${kind}/${LINK}`
      });

      expect(response.statusCode).toBe(404);
    }
  );
});
