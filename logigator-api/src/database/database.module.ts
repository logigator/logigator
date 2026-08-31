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
 * Owns the connection pool's lifetime: proves the database is reachable at
 * application init, and drains the pool on shutdown. `pg` connects lazily, so
 * without the probe a misconfigured `DATABASE_URL` would surface on the first
 * request; a lifecycle hook rather than the provider factory keeps unit specs,
 * which never init the graph, free of a live database.
 */
@Injectable()
class PoolLifecycle implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger('Database');

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onModuleInit(): Promise<void> {
    const connection = await this.pool.connect();
    connection.release();
    this.logger.log('Connected');
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
    PoolLifecycle
  ],
  exports: [DB, PG_POOL]
})
export class DatabaseModule {}
