import {
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Query,
  UseGuards
} from '@nestjs/common';
import {
  communityQuerySchema,
  pageQuerySchema,
  type Author,
  type CommunityComponent,
  type CommunityComponentDetail,
  type CommunityProject,
  type CommunityProjectDetail,
  type CommunityQuery,
  type Page,
  type PageQuery,
  type PublicProfile,
  type StarResponse
} from '@logigator/contract';
import { AuthGuard, CurrentUser, SessionUserId } from '../auth/auth.guard';
import { UuidParam } from '../common/uuid-param.pipe';
import type { UserRow } from '../database/schema';
import { CommunityService } from './community.service';

/**
 * The public half of the API: published documents, who made them, and stars.
 *
 * Nothing here is guarded except what writes — the listings are the reason
 * `AuthGuard` is applied per route rather than globally. They do read the session
 * when there is one, for the single boolean saying whether the caller has starred
 * a row; a visitor gets `false` and the same page.
 */
@Controller('community')
export class CommunityController {
  constructor(private readonly community: CommunityService) {}

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
   * What the caller has starred. Above the `:link` routes because `starred` is a
   * literal segment and a token is not — declared the other way round, a path
   * matcher could take it for one.
   */
  @Get('starred/projects')
  @UseGuards(AuthGuard)
  starredProjects(
    @CurrentUser() user: UserRow,
    @Query({ schema: pageQuerySchema }) query: PageQuery
  ): Promise<Page<CommunityProject>> {
    return this.community.listStarredProjects(user.id, query);
  }

  @Get('starred/components')
  @UseGuards(AuthGuard)
  starredComponents(
    @CurrentUser() user: UserRow,
    @Query({ schema: pageQuerySchema }) query: PageQuery
  ): Promise<Page<CommunityComponent>> {
    return this.community.listStarredComponents(user.id, query);
  }

  @Get('projects/:link')
  projectDetail(
    @Param('link', UuidParam) link: string,
    @SessionUserId() callerId: string | null
  ): Promise<CommunityProjectDetail> {
    return this.community.projectDetail(link, callerId);
  }

  @Get('components/:link')
  componentDetail(
    @Param('link', UuidParam) link: string,
    @SessionUserId() callerId: string | null
  ): Promise<CommunityComponentDetail> {
    return this.community.componentDetail(link, callerId);
  }

  /**
   * `PUT`/`DELETE` rather than a `POST /toggle`: each states the state it wants,
   * so a retried request lands where the caller meant instead of undoing itself.
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
    @Query({ schema: pageQuerySchema }) query: PageQuery,
    @SessionUserId() callerId: string | null
  ): Promise<Page<CommunityProject>> {
    return this.community.listUserProjects(id, query, callerId);
  }

  @Get('users/:id/components')
  userComponents(
    @Param('id', UuidParam) id: string,
    @Query({ schema: pageQuerySchema }) query: PageQuery,
    @SessionUserId() callerId: string | null
  ): Promise<Page<CommunityComponent>> {
    return this.community.listUserComponents(id, query, callerId);
  }
}
