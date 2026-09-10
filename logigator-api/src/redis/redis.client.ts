import { createClient } from 'redis';

export const REDIS = Symbol('REDIS');

/**
 * Creates the client — not connected yet; {@link RedisModule} connects it in a
 * lifecycle hook.
 */
export function createRedisClient(url: string) {
  return createClient({ url });
}

/**
 * Derived from the factory rather than written out: node-redis' exported
 * `RedisClientType` is generic over the modules a client was created with, and
 * naming it directly yields a constraint instantiation the concrete client is
 * not assignable to (the command signatures are invariant in `this`).
 */
export type RedisClient = ReturnType<typeof createRedisClient>;
