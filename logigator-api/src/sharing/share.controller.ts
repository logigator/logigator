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
import { AuthGuard, CurrentUser, SessionUserId } from '../auth/auth.guard';
import { UuidParam } from '../common/uuid-param.pipe';
import type { UserRow } from '../database/schema';
import { CloneService } from './clone.service';
import { ShareKindParam } from './share-kind.pipe';
import { CARD_MAX_AGE_SECONDS, ShareCardService } from './share-card.service';
import { ShareService, type ShareKind } from './share.service';

/**
 * Documents reached by their share link. Both segments are checked before
 * anything is looked up: the kind names a table, the token names a row of it.
 *
 * Neither read needs a session — holding an address is what lets a stranger
 * read an unlisted document — but they take the caller when there is one,
 * because a private document resolves for its owner. Cloning needs a session
 * outright, since it writes into an account.
 */
@Controller('share')
export class ShareController {
  constructor(
    private readonly share: ShareService,
    private readonly clone: CloneService,
    private readonly cards: ShareCardService
  ) {}

  @Get(':kind/:link')
  read(
    @Param('kind', ShareKindParam) kind: ShareKind,
    @Param('link', UuidParam) link: string,
    @SessionUserId() callerId: string | null
  ): Promise<ShareResponse> {
    return this.share.read(kind, link, callerId);
  }

  /**
   * The document as a picture, for the surfaces that unfurl a pasted link.
   *
   * One route per kind for every consumer: the pages of a listed document name
   * it in their `og:image`, and an unlisted document's link unfurls the same
   * way. A private one's composes for nobody but its owner, which is the same
   * predicate the read carries — a card is the document, drawn.
   *
   * It is also the reason `robots.txt` carries an `Allow:` for this path —
   * fetchers honour the `Disallow: /api/` above it to varying degrees, and a
   * card a crawler may not fetch is a card that never renders.
   */
  @Get(':kind/:link/card.png')
  async card(
    @Param('kind', ShareKindParam) kind: ShareKind,
    @Param('link', UuidParam) link: string,
    @SessionUserId() callerId: string | null,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply
  ): Promise<void> {
    const { etag, png, publiclyReadable } = await this.cards.forLink(
      kind,
      link,
      callerId
    );

    reply
      .header('ETag', etag)
      // `public` only where anybody could have fetched this: a card composed
      // for a private document's owner is that owner's alone, and a shared
      // cache is exactly the holder the read's own predicate refuses.
      .header(
        'Cache-Control',
        publiclyReadable
          ? `public, max-age=${CARD_MAX_AGE_SECONDS}`
          : 'private, no-store'
      );

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
  @Post(':kind/:link/clone')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard)
  cloneShare(
    @CurrentUser() user: UserRow,
    @Param('kind', ShareKindParam) kind: ShareKind,
    @Param('link', UuidParam) link: string
  ): Promise<CloneResponse> {
    return this.clone.cloneByLink(user.id, kind, link);
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
