import { Global, Module } from '@nestjs/common';
import { ENV } from '../config/env';
import { CACHE_PURGE, createCachePurge } from './cache-purge/cache-purge';
import { CachePurgeQueue } from './cache-purge/cache-purge-queue';
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
 * `CachePurgeQueue` purges every removed file from the CDN through the
 * provider behind `CACHE_PURGE`.
 */
@Global()
@Module({
  providers: [
    { provide: CACHE_PURGE, inject: [ENV], useFactory: createCachePurge },
    CachePurgeQueue,
    FileStorageService,
    ImageService,
    OrphanSweepService
  ],
  exports: [
    CachePurgeQueue,
    FileStorageService,
    ImageService,
    OrphanSweepService
  ]
})
export class StorageModule {}
