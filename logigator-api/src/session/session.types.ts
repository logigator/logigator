/**
 * What the API keeps in a session: the signed-in user's id, and nothing else.
 * The rest is read from the database per request, so a profile change or an
 * account deletion takes effect immediately.
 */
declare module 'fastify' {
  interface Session {
    userId?: string;
  }
}

export {};
