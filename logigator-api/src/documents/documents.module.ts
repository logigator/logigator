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
import { RenormalizeService } from './renormalize.service';

/**
 * Stored circuits: the caller's own projects and library components.
 *
 * `AuthModule` for `AuthGuard`, applied route by route rather than globally — a
 * guard-everything default leaks a private document the first time somebody
 * forgets the opt-out decorator. `UsersModule` comes with it because Nest
 * builds a guard in the context of the module that used it, so the guard's own
 * dependencies must resolve from here.
 *
 * The services are exported so sharing and community read the same rows through
 * them, keeping "a document is parsed on the way in" true of every path.
 */
@Module({
  imports: [AuthModule, UsersModule],
  controllers: [ProjectsController, ComponentsController],
  providers: [
    CircuitDocumentService,
    DependenciesService,
    PreviewService,
    ProjectsService,
    ComponentsService,
    RenormalizeService
  ],
  exports: [
    CircuitDocumentService,
    DependenciesService,
    ProjectsService,
    ComponentsService,
    RenormalizeService
  ]
})
export class DocumentsModule {}
