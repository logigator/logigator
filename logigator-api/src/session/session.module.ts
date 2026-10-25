import { Global, Module } from '@nestjs/common';
import { RedisSessionStore } from './redis-session.store';
import { SessionService } from './session.service';

/**
 * Sessions live in Redis, keyed by a signed cookie. No JWT: a server-side
 * session can be revoked, and the cookie carries over to a websocket, where a
 * bearer token would need its own handshake.
 */
@Global()
@Module({
  providers: [RedisSessionStore, SessionService],
  exports: [RedisSessionStore, SessionService]
})
export class SessionModule {}
