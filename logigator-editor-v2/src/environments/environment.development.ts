import { Environment } from './environment.model';
import { LogLevel } from '../app/logging/log-level.enum';

export const environment: Environment = {
  apiUrl: '',
  gridSize: 16,
  loggingVerbosity: LogLevel.Debug,
  debug: {
    showGridBorders: true,
    showHitboxes: false,
    showOrigins: false,
    showConnectionPoints: false,
    showQuadTrees: false,
    debugMenu: true
  }
};
