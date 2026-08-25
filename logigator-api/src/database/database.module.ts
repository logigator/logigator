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
 * The handle inside `db.transaction(…)`. Derived from the callback's own
 * parameter rather than named directly, so it cannot drift from whatever the
 * driver actually hands over.
 */
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

/**
 * Either handle, for the queries that must be able to run inside a transaction
 * or on their own — a write's steps have to share one, while the read that
 * serves a request has nothing to join.
 */
export type Queryable = Database | Transaction;

/** DI token for {@link Database}. */
export const DB = Symbol('DB');

/** DI token for the underlying `pg` pool, for the rare caller that needs it. */
export const PG_POOL = Symbol('PG_POOL');

/**
 * Owns the connection pool's lifetime: proves the database is reachable at
 * application init, and drains the pool on shutdown (which the Fastify adapter's
 * shutdown hooks trigger on SIGINT/SIGTERM).
 *
 * `pg` connects lazily, so without the probe a misconfigured `DATABASE_URL`
 * would surface on the first request instead of at startup. Doing it in a
 * lifecycle hook rather than in the provider factory keeps unit specs — which
 * instantiate the module graph but never init it — free of a live database.
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
 * handle over a `pg` pool, and callers write explicit queries against the schema
 * in `schema/`. There are no entity classes, no lazy relations and no active
 * record — the legacy stack's `Promise<T>` relations were the single largest
 * source of accidental complexity, and this is the shape that forecloses them.
 *
 * Global, because everything below the HTTP layer needs it.
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
