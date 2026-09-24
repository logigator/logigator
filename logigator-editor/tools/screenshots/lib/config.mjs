import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { LANGUAGES, LOCALES, THEMES } from './origin.mjs';

/**
 * Facts about the editor and the browser, shared by every target: how a
 * capture is framed, where the scenes live, and how a pass reaches the app.
 * Anything a target could reasonably want differently — where its captures
 * land, what they are called, which colour schemes it wants — belongs in that
 * target's own `config.mjs`.
 *
 * The origin's own vocabulary — what it speaks, and the two schemes — is
 * `lib/origin.mjs`'s, and re-exported here because a target reaches it through
 * this module.
 */
export { LANGUAGES, LOCALES, THEMES };

/**
 * "200% zoom": two device pixels per CSS pixel, so the canvas (PixiJS
 * resolution follows `devicePixelRatio`) and the DOM chrome both come out at
 * 2×. Playwright clips stay in CSS px; the renderer applies the scale.
 */
export const DEVICE_SCALE_FACTOR = 2;

/**
 * The editor's desktop window. Clears the compact breakpoint (`max-width:
 * 64rem`) with room for the 320 px side-bar plus a board framing the example
 * circuits.
 */
export const DESKTOP_VIEWPORT = { width: 1280, height: 860 };

/**
 * The recorded scenes, as ordinary editor exports, one per scene. They are
 * facts about the editor rather than about any one target, so they live here
 * and both shoot the same circuits.
 */
export const CIRCUITS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'circuits'
);

/** One grid unit in CSS px at zoom 1 — `environment.gridSize`. */
export const GRID_SIZE = 16;

/**
 * Camera zoom for close-up board shots — a step on the editor's `1.2^n` ladder.
 * Pinned rather than fitted per circuit, so a gate is the same size on every
 * page.
 */
export const BOARD_ZOOM = 1.2 ** 3;

/**
 * Preferences pinned before the first paint, so no shot depends on run order.
 *
 * Editor-local only: the interface language and the colour scheme are not here
 * but reach the app as the origin-wide `preferences` cookie, which
 * `Editor.open` writes for every target. Pinning either one in localStorage
 * would be pinning a key the app stopped reading — which is what the language
 * did here until the cookie took over, and it failed silently.
 */
export const SEEDED_LOCAL_STORAGE = {
  'logigator.settings': JSON.stringify({
    fpsCounter: false,
    showGrid: true,
    autoStartSimulation: false
  }),
  // Silences the first-run nudge, the coach marks and the just-in-time hints.
  'logigator.onboarding.tips-enabled': 'false',
  'logigator.onboarding.nudge-dismissed': 'true',
  // Suppresses the "What's new" auto-popup. Any high version works — the
  // check is a plain inequality.
  'logigator.changelog.lastSeenVersion': '999.0.0',
  'logigator.minimap.collapsed': 'false'
};

/**
 * Chromium launch overrides: unset on a developer machine, which gets
 * Playwright's bundled build. A GPU-less container needs SwiftShader and a
 * browser outside Playwright's registry.
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
