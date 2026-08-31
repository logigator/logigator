import { Environment } from './environment.model';
import { version } from '../../package.json';

export const environment: Environment = {
  version,
  buildCommit: GIT_COMMIT,
  buildDate: BUILD_DATE ? new Date(BUILD_DATE) : null,
  apiUrl: '',
  editorUrl: '/editor',
  analytics: {
    posthogKey: 'phc_xSrwBeAfq8XzQWA4FxpPTLfVcycLwv5STWyXpwocR4vD',
    posthogHost: 'https://u.logigator.com',
    posthogUiHost: 'https://eu.posthog.com'
  }
};
