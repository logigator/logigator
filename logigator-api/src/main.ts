import { Logger } from '@nestjs/common';
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

void bootstrap().catch((error: unknown) => {
  // Nothing is listening when this runs, so every failure here is fatal: one
  // record through the logger the rest of the boot uses, rather than Node's
  // unhandled-rejection dump.
  new Logger('Bootstrap').fatal(error);
  process.exit(1);
});
