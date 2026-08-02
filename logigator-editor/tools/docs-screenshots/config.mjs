import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Circuit files the scenes are built from — plain editor exports (File → Export
 * to file), one per scene. Edit a scene by opening its file in the editor and
 * exporting it back over itself.
 */
export const CIRCUITS_DIR = path.join(here, 'circuits');

export const DEFAULT_BASE_URL = 'http://localhost:4200/editor';

/**
 * "200% zoom": every asset is rendered at two device pixels per CSS pixel, so
 * the canvas (PixiJS resolution follows `devicePixelRatio`) and the DOM chrome
 * are both captured at 2×. Playwright clips are always expressed in CSS px —
 * the scale factor is applied by the renderer, never by this tool.
 */
export const DEVICE_SCALE_FACTOR = 2;

/**
 * Desktop viewport. Wide enough to clear the compact breakpoint (which kicks in
 * below ~1100 CSS px and swaps the whole chrome) with room for the 320 px
 * side-bar plus a board that frames the example circuits.
 */
export const VIEWPORT = { width: 1280, height: 860 };

/** One grid unit in CSS px at zoom 1 — `environment.gridSize`. */
export const GRID_SIZE = 16;

/**
 * Camera zoom for close-up board shots. The editor's zoom ladder is `1.2^n`,
 * and `1.2^3` is the step whose apparent circuit size matches the existing doc
 * images. Pinning it (instead of fitting each circuit) keeps a gate the same
 * size on every page.
 */
export const BOARD_ZOOM = 1.2 ** 3;

/** Preferences pinned before the first paint, so no shot depends on run order. */
export const SEEDED_LOCAL_STORAGE = {
  'logigator.theme': 'dark',
  'logigator.settings': JSON.stringify({
    fpsCounter: false,
    showGrid: true,
    autoStartSimulation: false
  }),
  // Silences the first-run nudge, the coach marks and the just-in-time hints.
  'logigator.onboarding.tips-enabled': 'false',
  'logigator.onboarding.nudge-dismissed': 'true',
  // Suppresses the "What's new" auto-popup by claiming the current release was
  // already seen. Any high version works — the check is a plain inequality.
  'logigator.changelog.lastSeenVersion': '999.0.0',
  'logigator.minimap.collapsed': 'false'
};

/**
 * Chromium launch overrides. A developer machine needs neither and gets
 * Playwright's bundled build; a GPU-less container needs SwiftShader and a
 * browser outside Playwright's own registry.
 */
export function launchOptions() {
  const executablePath = process.env.LOGIGATOR_SHOTS_BROWSER;
  const extraArgs = process.env.LOGIGATOR_SHOTS_BROWSER_ARGS;
  return {
    headless: true,
    ...(executablePath ? { executablePath } : {}),
    ...(extraArgs ? { args: extraArgs.split(' ').filter(Boolean) } : {})
  };
}
