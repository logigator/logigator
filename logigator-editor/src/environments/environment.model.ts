import { LogLevel } from '../app/logging/log-level.enum';

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
  debug: {
    showGridBorders: boolean;
    showHitboxes: boolean;
    showOrigins: boolean;
    showConnectionPoints: boolean;
    showQuadTrees: boolean;
    /** Shows the title-bar "Debug" menu (compiled-board/renderer dumps, Project
     * Dump export/import). Off in production. */
    debugMenu: boolean;
    /** Installs the `window.__logigator` automation facade (agents/scripts
     * drive the editor through it). Off in production. */
    automationApi: boolean;
  };
}
