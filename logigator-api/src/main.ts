import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';

async function bootstrap(): Promise<void> {
  const env = loadEnv(process.env);

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.forEnv(env),
    new FastifyAdapter({ logger: { level: env.LOG_LEVEL } })
  );

  // Caddy proxies `/api/*` here; controllers declare their paths without it.
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();

  await app.listen({ host: env.HOST, port: env.PORT });
}

void bootstrap();
