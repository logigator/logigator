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
describe('the share card route', () => {
  let app: NestFastifyApplication;
  const png = Buffer.from('89504e470d0a1a0a', 'hex');

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ShareController],
      providers: [
        { provide: ShareService, useValue: {} },
        { provide: CloneService, useValue: {} },
        {
          provide: ShareCardService,
          useValue: { forLink: () => Promise.resolve({ etag: ETAG, png }) }
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

  function card(ifNoneMatch?: string) {
    return app.inject({
      method: 'GET',
      url: `/share/${LINK}/card.png`,
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
});
