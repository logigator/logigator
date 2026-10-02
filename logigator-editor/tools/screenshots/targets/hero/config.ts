import path from 'node:path';
import type { Pass, Shot } from '../../lib/target.ts';

export const TARGET = {
  /** Driven with `yarn start:editor:prod --define "AUTOMATION_API=true"`. */
  base: 'http://localhost:4200/editor',
  /** Beside the rest of the site's own media, where the home page imports it. */
  layout: () => path.join('src', 'assets')
};

/** `hero-board-dark.webp`: the scheme is the one axis the page picks along. */
export function fileName(shot: Shot, pass: Pass): string {
  return `${shot.name}-${pass.theme}.webp`;
}
