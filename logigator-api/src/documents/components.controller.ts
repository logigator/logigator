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
  createComponentRequestSchema,
  pageQuerySchema,
  putDocumentTextRequestSchema,
  saveCircuitRequestSchema,
  updateComponentRequestSchema,
  type ComponentResponse,
  type ComponentSummary,
  type CreateComponentRequest,
  type DocumentTextsResponse,
  type OwnedComponentSummary,
  type Page,
  type PageQuery,
  type PutDocumentTextRequest,
  type SaveCircuitRequest,
  type UpdateComponentRequest
} from '@logigator/contract';
import type { FastifyRequest } from 'fastify';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import type { LanguageId } from '@logigator/core';
import { localeFromRequest } from '../common/locale';
import { SiteLanguageParam } from '../common/site-language-param.pipe';
import { UuidParam } from '../common/uuid-param.pipe';
import { components, type UserRow } from '../database/schema';
import { toComponentSummary } from './circuit-responses';
import { readPreviewUpload } from './preview-upload';
import { PreviewService } from './preview.service';
import { ComponentsService } from './components.service';

/** The caller's own library components. Mirrors `ProjectsController`. */
@Controller('components')
@UseGuards(AuthGuard)
export class ComponentsController {
  constructor(
    private readonly components: ComponentsService,
    private readonly previews: PreviewService
  ) {}

  @Get()
  list(
    @CurrentUser() user: UserRow,
    @Query({ schema: pageQuerySchema }) query: PageQuery
  ): Promise<Page<OwnedComponentSummary>> {
    return this.components.list(user.id, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: UserRow,
    @Body({ schema: createComponentRequestSchema })
    body: CreateComponentRequest,
    @Req() request: FastifyRequest
  ): Promise<ComponentSummary> {
    return this.components.create(user.id, body, localeFromRequest(request));
  }

  @Get(':id')
  open(
    @CurrentUser() user: UserRow,
    @Param('id', UuidParam) id: string
  ): Promise<ComponentResponse> {
    return this.components.open(user.id, id);
  }

  @Put(':id')
  save(
    @CurrentUser() user: UserRow,
    @Param('id', UuidParam) id: string,
    @Body({ schema: saveCircuitRequestSchema })
    body: SaveCircuitRequest
  ): Promise<ComponentSummary> {
    return this.components.save(user.id, id, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: UserRow,
    @Param('id', UuidParam) id: string,
    @Body({ schema: updateComponentRequestSchema })
    body: UpdateComponentRequest,
    @Req() request: FastifyRequest
  ): Promise<ComponentSummary> {
    return this.components.update(
      user.id,
      id,
      body,
      localeFromRequest(request)
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @CurrentUser() user: UserRow,
    @Param('id', UuidParam) id: string
  ): Promise<void> {
    return this.components.delete(user.id, id);
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
    return this.components.putText(user.id, id, language, body);
  }

  @Delete(':id/texts/:lang')
  deleteText(
    @CurrentUser() user: UserRow,
    @Param('id', UuidParam) id: string,
    @Param('lang', SiteLanguageParam) language: LanguageId
  ): Promise<DocumentTextsResponse> {
    return this.components.deleteText(user.id, id, language);
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
  ): Promise<ComponentSummary> {
    const sources = await readPreviewUpload(request);
    return toComponentSummary(
      await this.previews.replace(components, user.id, id, sources)
    );
  }

  @Delete(':id/preview')
  async removePreview(
    @CurrentUser() user: UserRow,
    @Param('id', UuidParam) id: string
  ): Promise<ComponentSummary> {
    return toComponentSummary(
      await this.previews.clear(components, user.id, id)
    );
  }
}
