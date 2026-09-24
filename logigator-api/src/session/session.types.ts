/**
 * What the API keeps in a session: the signed-in user's id, and the last time
 * the session was pushed out. Everything about the account is read from the
 * database per request, so a profile change or an account deletion takes effect
 * immediately.
 */
declare module 'fastify' {
  interface Session {
    userId?: string;
    /**
     * Epoch milliseconds of the last refresh. Stored in the session rather than
     * beside it because `@fastify/session` decides to save by hashing these
     * fields, so writing it *is* the request to save.
     */
    touchedAt?: number;
  }
}

export {};
