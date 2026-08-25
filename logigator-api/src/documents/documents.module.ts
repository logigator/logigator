import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { CircuitDocumentService } from './circuit-document.service';
import { ComponentsController } from './components.controller';
import { ComponentsService } from './components.service';
import { DependenciesService } from './dependencies.service';
import { PreviewService } from './preview.service';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

/**
 * Stored circuits: the caller's own projects and library components.
 *
 * `AuthModule` for `AuthGuard`, which is imported route by route rather than
 * registered globally — public community listings are coming, and a
 * guard-everything default leaks a private document the first time somebody
 * forgets the opt-out decorator. `UsersModule` comes with it because
 * `@UseGuards(AuthGuard)` names a class, and Nest builds it in the context of
 * the module that used it — so the guard's own dependencies have to be
 * resolvable from here, not merely from where it was declared.
 *
 * The services are exported because the sharing and community modules read the
 * same rows through them, which is what keeps "a document is parsed on the way
 * in" true of every path rather than of this one.
 */
@Module({
  imports: [AuthModule, UsersModule],
  controllers: [ProjectsController, ComponentsController],
  providers: [
    CircuitDocumentService,
    DependenciesService,
    PreviewService,
    ProjectsService,
    ComponentsService
  ],
  exports: [
    CircuitDocumentService,
    DependenciesService,
    ProjectsService,
    ComponentsService
  ]
})
export class DocumentsModule {}
