import { LogLevel } from '../app/logging/log-level.enum';

/**
 * The editor's fixed configuration. What differs between deployments, such as
 * the PostHog key, comes from the API's `GET /api/meta` instead, so one build
 * serves any deployment. Developer switches are not here — they are esbuild
 * defines (see `src/define.d.ts`) so they can be flipped per build or serve
 * without editing tracked source.
 */
export interface Environment {
  /** Logigator's version, from the root package.json. */
  version: string;
  /** Git short SHA the bundle was built from; empty when not stamped (dev). */
  buildCommit: string;
  /** Timestamp the bundle was built at; null when not stamped (dev). */
  buildDate: Date | null;
  apiUrl: string;
  gridSize: number;
  /** Minimum severity printed to the console; messages below it are dropped. */
  loggingVerbosity: LogLevel;
  /**
   * Where PostHog is reached. The key is the deployment's, from `GET /api/meta`,
   * so a deployment without one sends nothing to either host.
   */
  analytics: {
    /** PostHog ingestion host — the `u.logigator.com` reverse proxy. */
    posthogHost: string;
    /** PostHog app host for toolbar/session links, bypassing the proxy. */
    posthogUiHost: string;
  };
}
