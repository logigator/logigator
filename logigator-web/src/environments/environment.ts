import { Environment } from './environment.model';
import { version } from '../../../package.json';

export const environment: Environment = {
  version,
  buildCommit: GIT_COMMIT,
  buildDate: BUILD_DATE ? new Date(BUILD_DATE) : null,
  apiUrl: '',
  editorUrl: '/editor',
  analytics: {
    posthogHost: 'https://u.logigator.com',
    posthogUiHost: 'https://eu.posthog.com'
  }
};
