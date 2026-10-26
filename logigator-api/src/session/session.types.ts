/**
 * What the API keeps in a session: the signed-in user's id, when they signed
 * in, and the last time the session was pushed out. Everything about the
 * account is read from the database per request, so a profile change or an
 * account deletion takes effect immediately.
 */
declare module 'fastify' {
  interface Session {
    userId?: string;
    /**
     * Epoch milliseconds of the sign-in that bound this session to `userId`.
     * Sliding the expiry leaves it alone, so it says how long ago the member
     * last proved who they are. Absent on sessions older than the field, which
     * reads as long ago.
     */
    signedInAt?: number;
    /**
     * Epoch milliseconds of the last refresh. Stored in the session rather than
     * beside it because `@fastify/session` decides to save by hashing these
     * fields, so writing it *is* the request to save.
     */
    touchedAt?: number;
  }
}

export {};
