import { Global, Module } from '@nestjs/common';
import { FileStorageService } from './file-storage.service';
import { ImageService } from './image.service';
import { OrphanSweepService } from './orphan-sweep.service';

/**
 * Global, because the rule it implements is workspace-wide: canonical, queried,
 * transactional data goes in the database; derived, browser-served, regenerable
 * binaries go on a volume. Avatars and circuit previews are both.
 *
 * Three services, because placing files, producing them and cleaning up after
 * them are separate jobs: `ImageService` turns one upload into the set of
 * encodings clients should get, `FileStorageService` puts a set of files
 * somewhere immutable, and `OrphanSweepService` deletes what a crash between a
 * write and a pointer update left behind.
 */
@Global()
@Module({
  providers: [FileStorageService, ImageService, OrphanSweepService],
  exports: [FileStorageService, ImageService, OrphanSweepService]
})
export class StorageModule {}
