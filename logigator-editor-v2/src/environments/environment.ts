import { Environment } from './environment.model';
import { LogLevel } from '../app/logging/log-level.enum';

export const environment: Environment = {
  apiUrl: '',
  gridSize: 16,
  loggingVerbosity: LogLevel.Warn,
  debug: {
    showGridBorders: false,
    showHitboxes: false,
    showOrigins: false,
    showConnectionPoints: false,
    showQuadTrees: false,
    debugMenu: false
  }
};
