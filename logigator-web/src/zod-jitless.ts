import * as z from 'zod';

/**
 * Keeps zod from probing `new Function` when the first object schema is
 * built: the site's policy has no `'unsafe-eval'`, and the probe is reported
 * as a violation even though zod catches the throw. It must run before any
 * module that builds a schema, so `main.ts` imports it first.
 */
z.config({ jitless: true });
