import { DESKTOP_VIEWPORT, LOCALES } from '../../lib/config.mjs';
import { TARGET, fileName } from './config.mjs';
import { writeRegistry } from './registry.mjs';
import { SHOTS } from './shots.mjs';

/**
 * The in-editor documentation's screenshots, under
 * `logigator-docs/src/pages/<lang>/images/`. Single-themed, because the
 * documentation is read on the editor's dark surface — which is what the run
 * pins the editor's preferences to, through the same cookie every app reads.
 */
export default {
  locales: LOCALES,
  themes: ['dark'],
  viewport: DESKTOP_VIEWPORT,
  ...TARGET,
  shots: SHOTS,
  fileName,
  writeRegistry
};
