import {
  Global,
  Inject,
  Injectable,
  Logger,
  Module,
  type OnApplicationShutdown,
  type OnModuleInit
} from '@nestjs/common';
import { ENV, type Env } from '../config/env';
import { createRedisClient, REDIS, type RedisClient } from './redis.client';
import { RedisService } from './redis.service';

/**
 * Connects at application init and closes on shutdown. A lifecycle hook rather
 * than the provider factory keeps unit specs free of infrastructure:
 * instantiating the module graph opens no socket, while a real bootstrap still
 * fails immediately on an unreachable Redis.
 */
@Injectable()
class RedisConnection implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger('Redis');

  constructor(@Inject(REDIS) private readonly client: RedisClient) {}

  async onModuleInit(): Promise<void> {
    await this.client.connect();
    this.logger.log('Connected');
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.client.isOpen) await this.client.close();
  }
}

/**
 * One client, shared process-wide. The `error` listener is not optional:
 * node-redis reports connection trouble by emitting `error` and reconnects on
 * its own, and an unhandled `error` event takes the process down.
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [ENV],
      useFactory: (env: Env): RedisClient => {
        const logger = new Logger('Redis');
        const client = createRedisClient(env.REDIS_URL);
        client.on('error', (error: unknown) =>
          logger.error('Client error', error)
        );
        return client;
      }
    },
    RedisService,
    RedisConnection
  ],
  exports: [REDIS, RedisService]
})
export class RedisModule {}
