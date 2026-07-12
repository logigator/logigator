import { Environment } from './environment.model';
import { LogLevel } from '../app/logging/log-level.enum';
import { version } from '../../package.json';

export const environment: Environment = {
  version,
  buildCommit: GIT_COMMIT,
  buildDate: BUILD_DATE ? new Date(BUILD_DATE) : null,
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
