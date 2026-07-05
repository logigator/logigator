import { LogLevel } from '../app/logging/log-level.enum';

export interface Environment {
  apiUrl: string;
  gridSize: number;
  /** Minimum severity printed to the console; messages below it are dropped. */
  loggingVerbosity: LogLevel;
  debug: {
    showGridBorders: boolean;
    showHitboxes: boolean;
    showOrigins: boolean;
    showConnectionPoints: boolean;
    showQuadTrees: boolean;
    /** Shows the title-bar "Debug" menu (compiled-board/renderer dumps, Project
     * Dump export/import). Off in production. */
    debugMenu: boolean;
  };
}
