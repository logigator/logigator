import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';
import { registerSessionPlugins } from './session/session.plugin';

async function bootstrap(): Promise<void> {
  const env = loadEnv(process.env);

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.forEnv(env),
    new FastifyAdapter({
      logger: { level: env.LOG_LEVEL },
      // How many proxies sit in front of this process, so `request.ip` is the
      // client's address rather than Caddy's — the rate limiter counts per
      // address. Off by default: with no proxy in front, trusting the header
      // would let a caller pick its own identity.
      trustProxy: env.TRUST_PROXY === 0 ? false : env.TRUST_PROXY
    })
  );

  await registerSessionPlugins(app, env);

  // Caddy proxies `/api/*` here; controllers declare their paths without it.
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();

  await app.listen({ host: env.HOST, port: env.PORT });
}

void bootstrap();
