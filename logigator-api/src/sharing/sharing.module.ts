import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DocumentsModule } from '../documents/documents.module';
import { UsersModule } from '../users/users.module';
import { CloneService } from './clone.service';
import { ShareCardService } from './share-card.service';
import { ShareController } from './share.controller';
import { ShareService } from './share.service';

/**
 * Share links: reading a document through one, composing the card that unfurls
 * it, and copying it into an account. Built on `DocumentsModule`'s services
 * rather than its own queries, so a clone is parsed, counted and
 * dependency-extracted like any other write.
 */
@Module({
  imports: [DocumentsModule, AuthModule, UsersModule],
  controllers: [ShareController],
  providers: [ShareService, CloneService, ShareCardService],
  exports: [ShareService]
})
export class SharingModule {}
