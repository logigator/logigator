import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { apiServerOptions, configureApiApp } from './app.setup';
import { loadEnv } from './config/env';
import { PinoNestLogger } from './logging/pino-nest-logger';
import { MetricsServer } from './metrics/metrics.server';

async function bootstrap(): Promise<void> {
  const env = loadEnv(process.env);

  const adapter = new FastifyAdapter(apiServerOptions(env));
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.forEnv(env),
    adapter,
    // Nest's own lines and every `Logger` go out through Fastify's pino.
    { logger: new PinoNestLogger(adapter.getInstance().log) }
  );

  await configureApiApp(app, env);
  // A signal drains the server and runs every shutdown hook, then exits. Nest
  // would otherwise re-raise the signal at itself, which the kernel ignores
  // for PID 1 — the process the container runs.
  app.enableShutdownHooks([], { useProcessExit: true });

  await app.listen({ host: env.HOST, port: env.PORT });
  await app.get(MetricsServer).start();
}

void bootstrap().catch((error: unknown) => {
  // Nothing is listening when this runs, so every failure here is fatal: one
  // record through the logger the rest of the boot uses, rather than Node's
  // unhandled-rejection dump.
  new Logger('Bootstrap').fatal({
    event: 'error',
    err: error,
    msg: 'Startup failed'
  });
  process.exit(1);
});
