import { Environment } from './environment.model';
import { LogLevel } from '../app/logging/log-level.enum';
import { version } from '../../package.json';

export const environment: Environment = {
  version,
  buildCommit: GIT_COMMIT,
  buildDate: BUILD_DATE ? new Date(BUILD_DATE) : null,
  apiUrl: '',
  gridSize: 16,
  loggingVerbosity: LogLevel.Warn,
  analytics: {
    posthogKey: 'phc_xSrwBeAfq8XzQWA4FxpPTLfVcycLwv5STWyXpwocR4vD',
    posthogHost: 'https://u.logigator.com',
    posthogUiHost: 'https://eu.posthog.com'
  },
  debug: {
    showGridBorders: false,
    showHitboxes: false,
    showOrigins: false,
    showConnectionPoints: false,
    showQuadTrees: false,
    debugMenu: false
  }
};
