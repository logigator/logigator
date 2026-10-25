import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Post,
  Put,
  Query,
  UseGuards
} from '@nestjs/common';
import {
  communityPageQuerySchema,
  communityQuerySchema,
  pageQuerySchema,
  reportDocumentRequestSchema,
  textLanguageQuerySchema,
  type Author,
  type CommunityComponent,
  type CommunityComponentDetail,
  type CommunityPageQuery,
  type CommunityProject,
  type CommunityProjectDetail,
  type CommunityQuery,
  type DocumentTranslationResponse,
  type Page,
  type PageQuery,
  type PublicProfile,
  type ReportDocumentRequest,
  type ReportDocumentResponse,
  type StarResponse,
  type TextLanguageQuery
} from '@logigator/contract';
import type { LanguageId } from '@logigator/core';
import { AuthGuard, CurrentUser, SessionUserId } from '../auth/auth.guard';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { SiteLanguageParam } from '../common/site-language-param.pipe';
import { UuidParam } from '../common/uuid-param.pipe';
import type { UserRow } from '../database/schema';
import { DocumentReportsService } from '../reports/document-reports.service';
import { CommunityService } from './community.service';

/**
 * The public half of the API: published documents, who made them, and stars.
 * Only writes are guarded — these listings are why `AuthGuard` is per route
 * rather than global. They read the session when there is one, for the boolean
 * saying whether the caller starred a row; a visitor gets `false`.
 *
 * The two detail routes read it as well, and there it does more: a document's
 * page is served to whoever its link resolves for, which for a private document
 * is its owner — the preview the share dialog promises them before they publish
 * anything.
 */
@Controller('community')
export class CommunityController {
  constructor(
    private readonly community: CommunityService,
    private readonly reports: DocumentReportsService
  ) {}

  @Get('projects')
  listProjects(
    @Query({ schema: communityQuerySchema }) query: CommunityQuery,
    @SessionUserId() callerId: string | null
  ): Promise<Page<CommunityProject>> {
    return this.community.listProjects(query, callerId);
  }

  @Get('components')
  listComponents(
    @Query({ schema: communityQuerySchema }) query: CommunityQuery,
    @SessionUserId() callerId: string | null
  ): Promise<Page<CommunityComponent>> {
    return this.community.listComponents(query, callerId);
  }

  /**
   * Above the `:link` routes: declared after them, a path matcher could take
   * the literal `starred` segment for a token.
   */
  @Get('starred/projects')
  @UseGuards(AuthGuard)
  starredProjects(
    @CurrentUser() user: UserRow,
    @Query({ schema: communityPageQuerySchema }) query: CommunityPageQuery
  ): Promise<Page<CommunityProject>> {
    return this.community.listStarredProjects(user.id, query, user.id);
  }

  @Get('starred/components')
  @UseGuards(AuthGuard)
  starredComponents(
    @CurrentUser() user: UserRow,
    @Query({ schema: communityPageQuerySchema }) query: CommunityPageQuery
  ): Promise<Page<CommunityComponent>> {
    return this.community.listStarredComponents(user.id, query, user.id);
  }

  @Get('projects/:link')
  projectDetail(
    @Param('link', UuidParam) link: string,
    @Query({ schema: textLanguageQuerySchema }) query: TextLanguageQuery,
    @SessionUserId() callerId: string | null
  ): Promise<CommunityProjectDetail> {
    return this.community.projectDetail(link, query.lang, callerId);
  }

  @Get('components/:link')
  componentDetail(
    @Param('link', UuidParam) link: string,
    @Query({ schema: textLanguageQuerySchema }) query: TextLanguageQuery,
    @SessionUserId() callerId: string | null
  ): Promise<CommunityComponentDetail> {
    return this.community.componentDetail(link, query.lang, callerId);
  }

  /**
   * A document's machine translation, fetched by the page when its reader asks
   * for one. Kept out of every index and every cache: it is the one response
   * that carries machine text, which the site never renders on the server.
   */
  @Get('projects/:link/translation/:lang')
  @Header('X-Robots-Tag', 'noindex')
  @Header('Cache-Control', 'no-store')
  projectTranslation(
    @Param('link', UuidParam) link: string,
    @Param('lang', SiteLanguageParam) language: LanguageId,
    @SessionUserId() callerId: string | null
  ): Promise<DocumentTranslationResponse> {
    return this.community.projectTranslation(link, language, callerId);
  }

  @Get('components/:link/translation/:lang')
  @Header('X-Robots-Tag', 'noindex')
  @Header('Cache-Control', 'no-store')
  componentTranslation(
    @Param('link', UuidParam) link: string,
    @Param('lang', SiteLanguageParam) language: LanguageId,
    @SessionUserId() callerId: string | null
  ): Promise<DocumentTranslationResponse> {
    return this.community.componentTranslation(link, language, callerId);
  }

  /**
   * `PUT`/`DELETE` rather than a toggle: each states the state it wants, so a
   * retry lands where the caller meant instead of undoing itself.
   */
  @Put('projects/:link/star')
  @UseGuards(AuthGuard)
  starProject(
    @CurrentUser() user: UserRow,
    @Param('link', UuidParam) link: string
  ): Promise<StarResponse> {
    return this.community.setProjectStar(user.id, link, true);
  }

  @Delete('projects/:link/star')
  @UseGuards(AuthGuard)
  unstarProject(
    @CurrentUser() user: UserRow,
    @Param('link', UuidParam) link: string
  ): Promise<StarResponse> {
    return this.community.setProjectStar(user.id, link, false);
  }

  @Put('components/:link/star')
  @UseGuards(AuthGuard)
  starComponent(
    @CurrentUser() user: UserRow,
    @Param('link', UuidParam) link: string
  ): Promise<StarResponse> {
    return this.community.setComponentStar(user.id, link, true);
  }

  @Delete('components/:link/star')
  @UseGuards(AuthGuard)
  unstarComponent(
    @CurrentUser() user: UserRow,
    @Param('link', UuidParam) link: string
  ): Promise<StarResponse> {
    return this.community.setComponentStar(user.id, link, false);
  }

  /**
   * A report about a document, from anybody its link resolves for. No session
   * needed, since a notice about illegal content has to be open to everybody;
   * the session is recorded when there is one. Limited by address and sized
   * for a classroom behind one, which is far more reports than it ever sends.
   */
  @Post('projects/:link/report')
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 30, windowSeconds: 3600, scope: 'report-document' })
  async reportProject(
    @Param('link', UuidParam) link: string,
    @Body({ schema: reportDocumentRequestSchema }) body: ReportDocumentRequest,
    @SessionUserId() callerId: string | null
  ): Promise<ReportDocumentResponse> {
    await this.reports.report('project', link, body, callerId);
    return { received: true };
  }

  @Post('components/:link/report')
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 30, windowSeconds: 3600, scope: 'report-document' })
  async reportComponent(
    @Param('link', UuidParam) link: string,
    @Body({ schema: reportDocumentRequestSchema }) body: ReportDocumentRequest,
    @SessionUserId() callerId: string | null
  ): Promise<ReportDocumentResponse> {
    await this.reports.report('component', link, body, callerId);
    return { received: true };
  }

  @Get('projects/:link/stargazers')
  projectStargazers(
    @Param('link', UuidParam) link: string,
    @Query({ schema: pageQuerySchema }) query: PageQuery
  ): Promise<Page<Author>> {
    return this.community.projectStargazers(link, query);
  }

  @Get('components/:link/stargazers')
  componentStargazers(
    @Param('link', UuidParam) link: string,
    @Query({ schema: pageQuerySchema }) query: PageQuery
  ): Promise<Page<Author>> {
    return this.community.componentStargazers(link, query);
  }

  @Get('users/:id')
  profile(@Param('id', UuidParam) id: string): Promise<PublicProfile> {
    return this.community.profile(id);
  }

  @Get('users/:id/projects')
  userProjects(
    @Param('id', UuidParam) id: string,
    @Query({ schema: communityPageQuerySchema }) query: CommunityPageQuery,
    @SessionUserId() callerId: string | null
  ): Promise<Page<CommunityProject>> {
    return this.community.listUserProjects(id, query, callerId);
  }

  @Get('users/:id/components')
  userComponents(
    @Param('id', UuidParam) id: string,
    @Query({ schema: communityPageQuerySchema }) query: CommunityPageQuery,
    @SessionUserId() callerId: string | null
  ): Promise<Page<CommunityComponent>> {
    return this.community.listUserComponents(id, query, callerId);
  }

  /**
   * What a member has starred, publicly. The caller-scoped `starred/*` routes
   * above answer the same question about the session; these answer it about
   * somebody else, which is what a public profile's starred tabs show — and
   * the `starred` flag on a row is still the *caller's*, so the control reads
   * correctly for whoever is looking.
   */
  @Get('users/:id/starred/projects')
  userStarredProjects(
    @Param('id', UuidParam) id: string,
    @Query({ schema: communityPageQuerySchema }) query: CommunityPageQuery,
    @SessionUserId() callerId: string | null
  ): Promise<Page<CommunityProject>> {
    return this.community.listStarredProjects(id, query, callerId);
  }

  @Get('users/:id/starred/components')
  userStarredComponents(
    @Param('id', UuidParam) id: string,
    @Query({ schema: communityPageQuerySchema }) query: CommunityPageQuery,
    @SessionUserId() callerId: string | null
  ): Promise<Page<CommunityComponent>> {
    return this.community.listStarredComponents(id, query, callerId);
  }
}
