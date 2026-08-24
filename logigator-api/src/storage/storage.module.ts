import { Global, Module } from '@nestjs/common';
import { FileStorageService } from './file-storage.service';
import { ImageService } from './image.service';

/**
 * Global, because the rule it implements is workspace-wide: canonical, queried,
 * transactional data goes in the database; derived, browser-served, regenerable
 * binaries go on a volume. Avatars and circuit previews are both.
 *
 * Two services, because placing files and producing them are separate jobs:
 * `ImageService` turns one upload into the set of encodings clients should get,
 * and `FileStorageService` puts a set of files somewhere immutable.
 */
@Global()
@Module({
  providers: [FileStorageService, ImageService],
  exports: [FileStorageService, ImageService]
})
export class StorageModule {}
