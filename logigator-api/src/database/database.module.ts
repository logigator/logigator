import {
  Global,
  Inject,
  Injectable,
  Logger,
  Module,
  type OnApplicationShutdown,
  type OnModuleInit
} from '@nestjs/common';
import { Pool } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { ENV, type Env } from '../config/env';
import { defaultMigrationsFolder } from './migrate';
import { assertMigrationsAligned } from './migration-state';
import { relations } from './schema';

/** The typed Drizzle handle every repository injects. */
export type Database = NodePgDatabase<typeof relations>;

/**
 * The handle inside `db.transaction(…)`, derived from the callback's own
 * parameter so it cannot drift from what the driver hands over.
 */
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

/** Either handle, for a query that runs inside a transaction or on its own. */
export type Queryable = Database | Transaction;

export const DB = Symbol('DB');

export const PG_POOL = Symbol('PG_POOL');

/**
 * The folder holding the checked-in migrations. A provider rather than a
 * constant because its location depends on how the process was started: beside
 * the bundle in a deploy and in the dev loop, in the package when a spec runs
 * the source.
 */
export const MIGRATIONS_FOLDER = Symbol('MIGRATIONS_FOLDER');

/**
 * Owns the connection pool's lifetime: proves the database is reachable and
 * carries the schema this build was written against, and drains the pool on
 * shutdown. `pg` connects lazily, so without the probe a misconfigured
 * `DATABASE_URL` would surface on the first request; a lifecycle hook rather
 * than the provider factory keeps unit specs, which never init the graph, free
 * of a live database.
 *
 * The schema check is a gate, not a repair: nothing here applies a migration.
 * drizzle's migrator reads the applied set before opening its transaction and
 * takes no lock, so two replicas booting together would race on the same DDL;
 * migrating stays a release step run once, through the `migrate` entry point.
 */
@Injectable()
class PoolLifecycle implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger('Database');

  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(DB) private readonly db: Database,
    @Inject(MIGRATIONS_FOLDER) private readonly migrationsFolder: string
  ) {}

  async onModuleInit(): Promise<void> {
    const connection = await this.pool.connect();
    connection.release();
    this.logger.log('Connected');

    if (!this.env.DATABASE_MIGRATION_CHECK) {
      this.logger.warn(
        'Schema check skipped (DATABASE_MIGRATION_CHECK=false): the database may not carry the migrations this build expects'
      );
      return;
    }

    try {
      const newest = await assertMigrationsAligned(
        this.db,
        this.migrationsFolder
      );
      this.logger.log(`Schema at ${newest}`);
    } catch (error) {
      // A hook that throws skips `onApplicationShutdown`, so the pool just
      // proven has to be drained here for the process to exit on its own.
      await this.pool.end();
      throw error;
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}

/**
 * Data access is a typed query builder, not an ORM: `Database` is a Drizzle
 * handle over a `pg` pool and callers write explicit queries against `schema/`.
 * No entity classes, no lazy relations, no active record. Global, because
 * everything below the HTTP layer needs it.
 */
@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ENV],
      useFactory: (env: Env) =>
        new Pool({
          connectionString: env.DATABASE_URL,
          max: env.DATABASE_POOL_MAX
        })
    },
    {
      provide: DB,
      inject: [PG_POOL],
      useFactory: (pool: Pool): Database => drizzle({ client: pool, relations })
    },
    { provide: MIGRATIONS_FOLDER, useFactory: defaultMigrationsFolder },
    PoolLifecycle
  ],
  exports: [DB, PG_POOL]
})
export class DatabaseModule {}
