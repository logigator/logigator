/**
 * What the API keeps in a session: the signed-in user's id, and nothing else.
 *
 * Everything else about the user is read from the database per request, so a
 * profile change or an account deletion takes effect immediately instead of
 * lingering in a serialized copy until the session expires.
 */
declare module 'fastify' {
  interface Session {
    userId?: string;
  }
}

export {};
