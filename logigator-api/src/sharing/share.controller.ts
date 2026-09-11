import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UseGuards
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { CloneResponse, ShareResponse } from '@logigator/contract';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import { UuidParam } from '../common/uuid-param.pipe';
import type { UserRow } from '../database/schema';
import { CloneService } from './clone.service';
import { CARD_MAX_AGE_SECONDS, ShareCardService } from './share-card.service';
import { ShareService } from './share.service';

/**
 * Documents reached by their share link. The read needs no session — the link
 * is the capability. Cloning does, because it writes into an account.
 */
@Controller('share')
export class ShareController {
  constructor(
    private readonly share: ShareService,
    private readonly clone: CloneService,
    private readonly cards: ShareCardService
  ) {}

  @Get(':link')
  read(@Param('link', UuidParam) link: string): Promise<ShareResponse> {
    return this.share.read(link);
  }

  /**
   * The document as a picture, for the surfaces that unfurl a pasted link.
   *
   * One route for every consumer, the link being the capability: the public
   * pages name it in their `og:image`, and so would a landing page on the share
   * URL itself. It is also the reason `robots.txt` carries an `Allow:` for this
   * path — fetchers honour the `Disallow: /api/` above it to varying degrees,
   * and a card a crawler may not fetch is a card that never renders.
   */
  @Get(':link/card.png')
  async card(
    @Param('link', UuidParam) link: string,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply
  ): Promise<void> {
    const { etag, png } = await this.cards.forLink(link);

    reply
      .header('ETag', etag)
      .header('Cache-Control', `public, max-age=${CARD_MAX_AGE_SECONDS}`);

    if (matchesEtag(request.headers['if-none-match'], etag)) {
      await reply.code(HttpStatus.NOT_MODIFIED).send();
      return;
    }

    await reply.type('image/png').send(png);
  }

  /**
   * Copies the document, and the library it needs, into the caller's account.
   * `POST` because it creates rows: a link that clones on being fetched is one
   * a crawler or a link preview fires by looking at it.
   */
  @Post(':link/clone')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard)
  cloneShare(
    @CurrentUser() user: UserRow,
    @Param('link', UuidParam) link: string
  ): Promise<CloneResponse> {
    return this.clone.cloneByLink(user.id, link);
  }
}

/**
 * Whether the client already holds this card. `If-None-Match` is a list, and a
 * cache that revalidated through a transforming proxy sends the tag back marked
 * weak — neither of which means a different picture.
 */
function matchesEtag(header: string | undefined, etag: string): boolean {
  if (!header) return false;

  return header
    .split(',')
    .some((candidate) => candidate.trim().replace(/^W\//, '') === etag);
}
