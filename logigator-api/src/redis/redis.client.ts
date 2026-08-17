import { createClient } from 'redis';

/** DI token for the shared node-redis client. */
export const REDIS = Symbol('REDIS');

/**
 * Creates the client — not connected yet; {@link RedisModule} connects it in a
 * lifecycle hook.
 */
export function createRedisClient(url: string) {
  return createClient({ url });
}

/**
 * The client type, derived from the call above rather than written out.
 * node-redis builds its command surface from the modules a client was created
 * with, and its exported `RedisClientType` is generic over those — naming it
 * directly yields the constraint instantiation, which the concrete client is not
 * assignable to (the command signatures are invariant in `this`). Reading the
 * type off the factory keeps it exactly what that factory returns.
 */
export type RedisClient = ReturnType<typeof createRedisClient>;
