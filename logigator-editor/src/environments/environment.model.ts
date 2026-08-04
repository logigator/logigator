import { LogLevel } from '../app/logging/log-level.enum';

/**
 * Deployment configuration. Developer switches are not here — they are esbuild
 * defines (see `src/define.d.ts`) so they can be flipped per build or serve
 * without editing tracked source.
 */
export interface Environment {
  /** App version from package.json. */
  version: string;
  /** Git short SHA the bundle was built from; empty when not stamped (dev). */
  buildCommit: string;
  /** Timestamp the bundle was built at; null when not stamped (dev). */
  buildDate: Date | null;
  apiUrl: string;
  gridSize: number;
  /** Minimum severity printed to the console; messages below it are dropped. */
  loggingVerbosity: LogLevel;
  analytics: {
    /** PostHog project API key (public, write-only). Empty disables PostHog. */
    posthogKey: string;
    /** PostHog ingestion host — the `u.logigator.com` reverse proxy. */
    posthogHost: string;
    /** PostHog app host for toolbar/session links, bypassing the proxy. */
    posthogUiHost: string;
  };
}
