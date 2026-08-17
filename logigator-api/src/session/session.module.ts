import { Global, Module } from '@nestjs/common';
import { RedisSessionStore } from './redis-session.store';
import { SessionService } from './session.service';

/**
 * Sessions live in Redis and are keyed by a signed cookie. There is no JWT: a
 * server-side session can be revoked, and the same cookie will carry over to the
 * collaboration websocket later, where a bearer token would need its own
 * handshake.
 */
@Global()
@Module({
  providers: [RedisSessionStore, SessionService],
  exports: [RedisSessionStore, SessionService]
})
export class SessionModule {}
