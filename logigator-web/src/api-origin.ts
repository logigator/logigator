/**
 * Where a server-side reader reaches the API from. A deployment fact a bundle
 * cannot know: inside the compose network the API is a host of its own, while
 * in the browser it is a path on the same origin.
 *
 * One reader of the variable and one default, for the two things that reach the
 * API without a browser — the render's `API_ORIGIN` provider and the sitemap's
 * walk. Two copies of a fallback origin drift silently, and only in a
 * deployment that forgot to set the variable.
 */
export function apiOrigin(): string {
  return process.env['API_ORIGIN'] ?? 'http://localhost:3000';
}
