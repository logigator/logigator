import { Controller, Get, HttpStatus, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { HealthCheck, ReadinessResponse } from '@logigator/contract';
import { ApiException } from '../common/api-exception';
import { DB, type Database } from '../database/database.module';
import { RedisService } from '../redis/redis.service';

@Controller('health')
export class HealthController {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly redis: RedisService
  ) {}

  /**
   * Readiness: can this instance serve requests that touch its backing services?
   * Both checks always run, so a failure names every dependency that is down
   * rather than only the first.
   *
   * Liveness is `GET /meta` — it answers without reaching outside the process.
   */
  @Get('ready')
  async getReadiness(): Promise<ReadinessResponse> {
    const [database, redis] = await Promise.all([
      check(() => this.db.execute(sql`select 1`)),
      check(() => this.redis.client.ping())
    ]);

    if (!database.ok || !redis.ok) {
      throw new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'service_unavailable',
        'One or more backing services are unavailable.',
        {
          ...(database.error ? { database: [database.error] } : {}),
          ...(redis.error ? { redis: [redis.error] } : {})
        }
      );
    }

    return { status: 'ok', checks: { database, redis } };
  }
}

async function check(probe: () => Promise<unknown>): Promise<HealthCheck> {
  try {
    await probe();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'failed'
    };
  }
}
