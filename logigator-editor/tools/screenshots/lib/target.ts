import type { ViewportSize } from 'playwright';
import type { LanguageId, Theme } from './origin.ts';
import type { Editor, OpenOptions, SnapTarget } from './editor.ts';

/**
 * The shapes a target is written in. A target is one folder under `targets/`
 * whose `INDEX.ts` default-exports a {@link Target}; the runner loads it by the
 * folder's name.
 */

/** One language in one colour scheme — a run is every pass of its target. */
export interface Pass {
  lang: LanguageId;
  theme: Theme;
}

/**
 * What a shot hands back to be encoded: one frame to capture, or the frames it
 * already captured for a step-through. `delay` is the frame time of the latter.
 */
export type ShotResult = (SnapTarget | { frames: Buffer[] }) & {
  delay?: number;
};

export interface Shot {
  /** The capture's name, which the target's `fileName` builds on. */
  name: string;
  /** How the editor is staged before `run`, over what the target stages. */
  context?: OpenOptions;
  /** Stages the state the picture is of and returns what to capture. */
  run(editor: Editor): Promise<ShotResult>;
}

export interface Target {
  locales: readonly LanguageId[];
  themes: readonly Theme[];
  viewport: ViewportSize;
  /** Where the editor to shoot is served; `--base` overrides it. */
  base: string;
  /** Where one language's captures land under the out-dir. */
  layout(lang: LanguageId): string;
  shots: readonly Shot[];
  fileName(shot: Shot, pass: Pass): string;
  /** Writes the import map over what was captured; returns its path. */
  writeRegistry(dest: string): string;
  /** Staging every shot of a pass gets, beneath the shot's own. */
  before?(pass: Pass): OpenOptions;
}
