import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DocumentsModule } from '../documents/documents.module';
import { UsersModule } from '../users/users.module';
import { CloneService } from './clone.service';
import { ShareController } from './share.controller';
import { ShareService } from './share.service';

/**
 * Share links: reading a document through one, and copying it into an account.
 *
 * Built on `DocumentsModule`'s services rather than its own queries, so a clone
 * is written by the same code any other write goes through — parsed, counted and
 * dependency-extracted. A second write path would be a second chance for the
 * column's invariant to stop holding.
 */
@Module({
  imports: [DocumentsModule, AuthModule, UsersModule],
  controllers: [ShareController],
  providers: [ShareService, CloneService],
  exports: [ShareService]
})
export class SharingModule {}
