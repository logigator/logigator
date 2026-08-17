import { Global, Module } from '@nestjs/common';
import { FileStorageService } from './file-storage.service';

/**
 * Global, because the rule it implements is workspace-wide: canonical, queried,
 * transactional data goes in the database; derived, browser-served, regenerable
 * binaries go on a volume. Avatars are the first, previews the next.
 */
@Global()
@Module({
  providers: [FileStorageService],
  exports: [FileStorageService]
})
export class StorageModule {}
