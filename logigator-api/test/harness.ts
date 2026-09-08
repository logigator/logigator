import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { type DynamicModule, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  FastifyAdapter,
  type NestFastifyApplication
} from '@nestjs/platform-fastify';
import type { InjectOptions, LightMyRequestResponse } from 'fastify';
import { AppModule } from '../src/app.module';
import { apiServerOptions, configureApiApp } from '../src/app.setup';
import { ENV, loadEnv, type Env } from '../src/config/env';
import {
  DatabaseModule,
  DB,
  MIGRATIONS_FOLDER,
  type Database
} from '../src/database/database.module';
import { runMigrations } from '../src/database/migrate';
import { MAIL_TRANSPORT } from '../src/mail/mail.transport';
import { createRedisClient } from '../src/redis/redis.client';
import { MailCapture } from './mail-capture';

/**
 * The migrations in the package. The application resolves them beside its
 * bundle, which a spec running the source has no equivalent of, so every graph
 * booted here overrides the provider with this.
 */
export const MIGRATIONS_FOLDER_PATH = join(
  import.meta.dirname,
  '..',
  'drizzle'
);

/**
 * Where the throwaway databases are created. Explicit rather than defaulted:
 * the schema defaults name the compose services, and a suite that quietly
 * connected to whatever those resolve to could drop a real database.
 */
function requireServiceUrls(): { databaseUrl: string; redisUrl: string } {
  const databaseUrl = process.env['DATABASE_URL'];
  const redisUrl = process.env['REDIS_URL'];
  if (!databaseUrl || !redisUrl) {
    throw new Error(
      'The E2E suite needs DATABASE_URL and REDIS_URL pointing at throwaway services.\n' +
        'With the dev compose stack up:\n' +
        '  DATABASE_URL=postgresql://logigator:logigator@localhost:5432/logigator \\\n' +
        '  REDIS_URL=redis://localhost:6379 yarn test:e2e:api'
    );
  }
  return { databaseUrl, redisUrl };
}

/** The same server with a different database name. */
function withDatabase(url: string, database: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.href;
}

async function onAdminDatabase(url: string, statement: string): Promise<void> {
  // `CREATE DATABASE` cannot run in a transaction or against the database being
  // created, so it goes through the server's own database.
  const client = new Client({
    connectionString: withDatabase(url, 'postgres')
  });
  await client.connect();
  try {
    await client.query(statement);
  } finally {
    await client.end();
  }
}

export interface E2eApp {
  app: NestFastifyApplication;
  env: Env;
  db: Database;
  /** What the API tried to mail, in order. */
  mail: MailCapture;
  inject(options: InjectOptions): Promise<LightMyRequestResponse>;
  /** Drops the database, clears the Redis keys, removes the storage dir. */
  close(): Promise<void>;
}

/**
 * Boots the real application against a database of its own: fresh per spec
 * file, migrated by the same function a release runs, so these specs exercise
 * the schema a deploy produces and no spec sees another's rows. Redis is
 * shared, so every key is namespaced by the run and deleted afterwards.
 *
 * Two things differ from production: the mail transport is captured, and bcrypt
 * runs at its minimum cost.
 */
export async function startE2eApp(
  overrides: Record<string, string> = {}
): Promise<E2eApp> {
  const { databaseUrl, redisUrl } = requireServiceUrls();
  const run = randomUUID().replaceAll('-', '').slice(0, 12);
  const database = `logigator_e2e_${run}`;
  const storageDir = await mkdtemp(join(tmpdir(), 'logigator-e2e-'));

  await onAdminDatabase(databaseUrl, `CREATE DATABASE "${database}"`);
  const testDatabaseUrl = withDatabase(databaseUrl, database);
  await runMigrations(testDatabaseUrl, MIGRATIONS_FOLDER_PATH);

  const keyPrefix = `e2e:${run}:`;
  const env = loadEnv({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: testDatabaseUrl,
    REDIS_URL: redisUrl,
    REDIS_KEY_PREFIX: keyPrefix,
    STORAGE_DIR: storageDir,
    BCRYPT_COST: '4',
    PUBLIC_URL: 'http://logigator.test',
    ...overrides
  });

  const mail = new MailCapture();
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.forEnv(env)]
  })
    .overrideProvider(MAIL_TRANSPORT)
    .useValue(mail.transport)
    .overrideProvider(MIGRATIONS_FOLDER)
    .useValue(MIGRATIONS_FOLDER_PATH)
    .compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(apiServerOptions(env)),
    { logger: false }
  );
  // The registration production runs, so cookie signing, the session store and
  // the route prefix are the real ones.
  await configureApiApp(app, env);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  return {
    app,
    env,
    db: app.get<Database>(DB),
    mail,
    inject: (options) => app.inject(options),
    close: async () => {
      await app.close();
      await deleteRedisKeys(redisUrl, keyPrefix);
      await rm(storageDir, { recursive: true, force: true });
      await onAdminDatabase(databaseUrl, `DROP DATABASE "${database}"`);
    }
  };
}

/** Removes what the run wrote to Redis; the prefix keeps it to this run. */
async function deleteRedisKeys(url: string, prefix: string): Promise<void> {
  const client = createRedisClient(url);
  await client.connect();
  try {
    for await (const keys of client.scanIterator({
      MATCH: `${prefix}*`,
      COUNT: 100
    })) {
      if (keys.length > 0) await client.del(keys);
    }
  } finally {
    await client.close();
  }
}

/**
 * Hosts {@link DatabaseModule} on its own: the global `ENV` provider it injects,
 * and nothing else. The rest of the graph would bring Redis, the scheduler and
 * the HTTP layer along, none of which say anything about the schema.
 */
@Module({})
class DatabaseLayerHost {
  static forEnv(env: Env): DynamicModule {
    return {
      module: DatabaseLayerHost,
      global: true,
      imports: [DatabaseModule],
      providers: [{ provide: ENV, useValue: env }],
      exports: [ENV]
    };
  }
}

/**
 * Boots the database layer against `env`, so a spec can watch the startup
 * schema gate accept or reject a database. Rejects with what would have stopped
 * the application from listening.
 */
export async function startDatabaseLayer(
  env: Env
): Promise<() => Promise<void>> {
  const moduleRef = await Test.createTestingModule({
    imports: [DatabaseLayerHost.forEnv(env)]
  })
    .overrideProvider(MIGRATIONS_FOLDER)
    .useValue(MIGRATIONS_FOLDER_PATH)
    .compile();

  await moduleRef.init();
  return () => moduleRef.close();
}
