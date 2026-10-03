import { DESKTOP_VIEWPORT, LOCALES } from '../../lib/config.ts';
import type { Target } from '../../lib/target.ts';
import { TARGET, fileName } from './config.ts';
import { writeRegistry } from './registry.ts';
import { SHOTS } from './shots.ts';

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
} satisfies Target;
