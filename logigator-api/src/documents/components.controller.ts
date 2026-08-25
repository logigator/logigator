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
  createComponentRequestSchema,
  pageQuerySchema,
  saveCircuitRequestSchema,
  updateComponentRequestSchema,
  type ComponentResponse,
  type ComponentSummary,
  type CreateComponentRequest,
  type Page,
  type PageQuery,
  type SaveCircuitRequest,
  type UpdateComponentRequest
} from '@logigator/contract';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import type { UserRow } from '../database/schema';
import { mapPage, toComponentSummary } from './circuit-responses';
import { ComponentsService } from './components.service';

/** The caller's own library components. Mirrors `ProjectsController`. */
@Controller('components')
@UseGuards(AuthGuard)
export class ComponentsController {
  constructor(private readonly components: ComponentsService) {}

  @Get()
  async list(
    @CurrentUser() user: UserRow,
    @Query(new ZodValidationPipe(pageQuerySchema)) query: PageQuery
  ): Promise<Page<ComponentSummary>> {
    return mapPage(
      await this.components.list(user.id, query),
      toComponentSummary
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: UserRow,
    @Body(new ZodValidationPipe(createComponentRequestSchema))
    body: CreateComponentRequest
  ): Promise<ComponentSummary> {
    return this.components.create(user.id, body);
  }

  @Get(':id')
  open(
    @CurrentUser() user: UserRow,
    @Param('id') id: string
  ): Promise<ComponentResponse> {
    return this.components.open(user.id, id);
  }

  @Put(':id')
  save(
    @CurrentUser() user: UserRow,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(saveCircuitRequestSchema))
    body: SaveCircuitRequest
  ): Promise<ComponentSummary> {
    return this.components.save(user.id, id, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: UserRow,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateComponentRequestSchema))
    body: UpdateComponentRequest
  ): Promise<ComponentSummary> {
    return this.components.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@CurrentUser() user: UserRow, @Param('id') id: string): Promise<void> {
    return this.components.delete(user.id, id);
  }
}
