import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { apiServerOptions, configureApiApp } from './app.setup';
import { loadEnv } from './config/env';

async function bootstrap(): Promise<void> {
  const env = loadEnv(process.env);

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.forEnv(env),
    new FastifyAdapter(apiServerOptions(env))
  );

  await configureApiApp(app, env);
  app.enableShutdownHooks();

  await app.listen({ host: env.HOST, port: env.PORT });
}

void bootstrap();
