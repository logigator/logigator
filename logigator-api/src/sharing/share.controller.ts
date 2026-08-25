import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards
} from '@nestjs/common';
import type { CloneResponse, ShareResponse } from '@logigator/contract';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import { UuidParam } from '../common/uuid-param.pipe';
import type { UserRow } from '../database/schema';
import { CloneService } from './clone.service';
import { ShareService } from './share.service';

/**
 * Documents reached by their share link.
 *
 * The read needs no session: the link is the capability, and requiring an
 * account to open one would defeat the point of handing somebody a URL. Cloning
 * does need one, because it writes into an account.
 */
@Controller('share')
export class ShareController {
  constructor(
    private readonly share: ShareService,
    private readonly clone: CloneService
  ) {}

  @Get(':link')
  read(@Param('link', UuidParam) link: string): Promise<ShareResponse> {
    return this.share.read(link);
  }

  /**
   * Copies the document, and the library it needs, into the caller's account.
   *
   * `POST` rather than the legacy `GET /clone/:link`: it creates rows, and a
   * link that clones on being fetched is one a crawler or a link preview can
   * fire by looking at it.
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
