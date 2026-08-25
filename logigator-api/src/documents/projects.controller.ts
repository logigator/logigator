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
  UseGuards
} from '@nestjs/common';
import {
  createProjectRequestSchema,
  pageQuerySchema,
  saveCircuitRequestSchema,
  updateProjectRequestSchema,
  type CreateProjectRequest,
  type Page,
  type PageQuery,
  type ProjectResponse,
  type ProjectSummary,
  type SaveCircuitRequest,
  type UpdateProjectRequest
} from '@logigator/contract';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import type { UserRow } from '../database/schema';
import { mapPage, toProjectSummary } from './circuit-responses';
import { ProjectsService } from './projects.service';

/**
 * The caller's own projects. Every route needs a session and describes only what
 * the caller owns; a public project is read through `/share` or `/community`.
 */
@Controller('projects')
@UseGuards(AuthGuard)
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  async list(
    @CurrentUser() user: UserRow,
    @Query(new ZodValidationPipe(pageQuerySchema)) query: PageQuery
  ): Promise<Page<ProjectSummary>> {
    return mapPage(await this.projects.list(user.id, query), toProjectSummary);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: UserRow,
    @Body(new ZodValidationPipe(createProjectRequestSchema))
    body: CreateProjectRequest
  ): Promise<ProjectSummary> {
    return this.projects.create(user.id, body);
  }

  @Get(':id')
  open(
    @CurrentUser() user: UserRow,
    @Param('id') id: string
  ): Promise<ProjectResponse> {
    return this.projects.open(user.id, id);
  }

  /** Saves the circuit. See `saveCircuitRequestSchema` for the version handshake. */
  @Put(':id')
  save(
    @CurrentUser() user: UserRow,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(saveCircuitRequestSchema))
    body: SaveCircuitRequest
  ): Promise<ProjectSummary> {
    return this.projects.save(user.id, id, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: UserRow,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateProjectRequestSchema))
    body: UpdateProjectRequest
  ): Promise<ProjectSummary> {
    return this.projects.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@CurrentUser() user: UserRow, @Param('id') id: string): Promise<void> {
    return this.projects.delete(user.id, id);
  }
}
