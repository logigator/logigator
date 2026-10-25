import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import {
  createProjectRequestSchema,
  pageQuerySchema,
  putDocumentTextRequestSchema,
  saveCircuitRequestSchema,
  updateProjectRequestSchema,
  type CreateProjectRequest,
  type DocumentTextsResponse,
  type OwnedProjectSummary,
  type Page,
  type PageQuery,
  type PutDocumentTextRequest,
  type ProjectResponse,
  type ProjectSummary,
  type SaveCircuitRequest,
  type UpdateProjectRequest
} from '@logigator/contract';
import type { FastifyRequest } from 'fastify';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import type { LanguageId } from '@logigator/core';
import { localeFromRequest } from '../common/locale';
import { SiteLanguageParam } from '../common/site-language-param.pipe';
import { UuidParam } from '../common/uuid-param.pipe';
import { projects, type UserRow } from '../database/schema';
import { toProjectSummary } from './circuit-responses';
import { readPreviewUpload } from './preview-upload';
import { PreviewService } from './preview.service';
import { ProjectsService } from './projects.service';

/**
 * The caller's own projects. Every route needs a session and describes only what
 * the caller owns; a public project is read through `/share` or `/community`.
 */
@Controller('projects')
@UseGuards(AuthGuard)
export class ProjectsController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly previews: PreviewService
  ) {}

  @Get()
  list(
    @CurrentUser() user: UserRow,
    @Query({ schema: pageQuerySchema }) query: PageQuery
  ): Promise<Page<OwnedProjectSummary>> {
    return this.projects.list(user.id, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: UserRow,
    @Body({ schema: createProjectRequestSchema })
    body: CreateProjectRequest,
    @Req() request: FastifyRequest
  ): Promise<ProjectSummary> {
    return this.projects.create(user.id, body, localeFromRequest(request));
  }

  @Get(':id')
  open(
    @CurrentUser() user: UserRow,
    @Param('id', UuidParam) id: string
  ): Promise<ProjectResponse> {
    return this.projects.open(user.id, id);
  }

  @Put(':id')
  save(
    @CurrentUser() user: UserRow,
    @Param('id', UuidParam) id: string,
    @Body({ schema: saveCircuitRequestSchema })
    body: SaveCircuitRequest
  ): Promise<ProjectSummary> {
    return this.projects.save(user.id, id, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: UserRow,
    @Param('id', UuidParam) id: string,
    @Body({ schema: updateProjectRequestSchema })
    body: UpdateProjectRequest,
    @Req() request: FastifyRequest
  ): Promise<ProjectSummary> {
    return this.projects.update(user.id, id, body, localeFromRequest(request));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @CurrentUser() user: UserRow,
    @Param('id', UuidParam) id: string
  ): Promise<void> {
    return this.projects.delete(user.id, id);
  }

  /**
   * The author's version of the name and description in one site language.
   * `PUT` replaces the version whole and `DELETE` removes it; both answer the
   * owner's text fields as they stand afterwards, as the owner's reads carry
   * them.
   */
  @Put(':id/texts/:lang')
  putText(
    @CurrentUser() user: UserRow,
    @Param('id', UuidParam) id: string,
    @Param('lang', SiteLanguageParam) language: LanguageId,
    @Body({ schema: putDocumentTextRequestSchema })
    body: PutDocumentTextRequest
  ): Promise<DocumentTextsResponse> {
    return this.projects.putText(user.id, id, language, body);
  }

  @Delete(':id/texts/:lang')
  deleteText(
    @CurrentUser() user: UserRow,
    @Param('id', UuidParam) id: string,
    @Param('lang', SiteLanguageParam) language: LanguageId
  ): Promise<DocumentTextsResponse> {
    return this.projects.deleteText(user.id, id, language);
  }

  /**
   * Replaces the preview: one render per theme, in one multipart request, both
   * replaced together. Not an edit, so `version` and the edit time stand.
   */
  @Post(':id/preview')
  async setPreview(
    @CurrentUser() user: UserRow,
    @Param('id', UuidParam) id: string,
    @Req() request: FastifyRequest
  ): Promise<ProjectSummary> {
    const sources = await readPreviewUpload(request);
    return toProjectSummary(
      await this.previews.replace(projects, user.id, id, sources)
    );
  }

  @Delete(':id/preview')
  async removePreview(
    @CurrentUser() user: UserRow,
    @Param('id', UuidParam) id: string
  ): Promise<ProjectSummary> {
    return toProjectSummary(await this.previews.clear(projects, user.id, id));
  }
}
