/** Deployment configuration for the website. */
export interface Environment {
  /** App version from package.json. */
  version: string;
  /** Git short SHA the bundle was built from; empty when not stamped (dev). */
  buildCommit: string;
  /** Timestamp the bundle was built at; null when not stamped (dev). */
  buildDate: Date | null;
  /**
   * Base the browser prefixes API paths with. Empty means the same origin,
   * which is how the site is always deployed — Caddy answers `/api` from the
   * API. The server render cannot use a relative URL and reads its own origin
   * from the environment instead (`API_ORIGIN`, see `api-origin.ts`).
   */
  apiUrl: string;
  /**
   * Where the editor is mounted on this origin. Links into it are built from
   * here rather than written out, since the site and the editor are separate
   * deployments that only share a hostname.
   */
  editorUrl: string;
  analytics: {
    /** PostHog project API key (public, write-only). Empty disables PostHog. */
    posthogKey: string;
    /** PostHog ingestion host — the `u.logigator.com` reverse proxy. */
    posthogHost: string;
    /** PostHog app host for toolbar/session links, bypassing the proxy. */
    posthogUiHost: string;
  };
}
