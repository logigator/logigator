import { Global, Module } from '@nestjs/common';
import { FileStorageService } from './file-storage.service';
import { ImageService } from './image.service';
import { OrphanSweepService } from './orphan-sweep.service';

/**
 * Global, because the rule is workspace-wide: canonical, queried, transactional
 * data goes in the database, and derived regenerable binaries — avatars and
 * circuit previews — go on a volume.
 *
 * `ImageService` turns one upload into the encodings clients get,
 * `FileStorageService` puts a set of files somewhere immutable, and
 * `OrphanSweepService` collects what a crash between the two left behind.
 */
@Global()
@Module({
  providers: [FileStorageService, ImageService, OrphanSweepService],
  exports: [FileStorageService, ImageService, OrphanSweepService]
})
export class StorageModule {}
