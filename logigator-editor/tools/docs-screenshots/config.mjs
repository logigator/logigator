import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Circuit files the scenes are built from — plain editor exports (File → Export
 * to file), one per scene. Edit a scene by opening its file in the editor and
 * exporting it back over itself.
 */
export const CIRCUITS_DIR = path.join(here, 'circuits');

/**
 * The editor's translations, which every label a shot matches on is resolved
 * out of — see `lib/i18n.mjs`.
 */
export const I18N_DIR = path.join(here, '..', '..', 'src', 'i18n');

/**
 * The languages the editor ships, in the order a full run captures them.
 * English comes first: the other languages are compared against it, and a
 * capture that comes out byte-identical is not written at all — the
 * documentation falls back to the English picture for it.
 */
export const LOCALES = ['en', 'de', 'fr', 'es'];

export const DEFAULT_BASE_URL = 'http://localhost:4200/editor';

/**
 * "200% zoom": every asset is rendered at two device pixels per CSS pixel, so
 * the canvas (PixiJS resolution follows `devicePixelRatio`) and the DOM chrome
 * are both captured at 2×. Playwright clips are always expressed in CSS px —
 * the scale factor is applied by the renderer, never by this tool.
 */
export const DEVICE_SCALE_FACTOR = 2;

/**
 * Desktop viewport. Wide enough to clear the compact breakpoint (`max-width:
 * 64rem`, so 1025 px is the first desktop width) with room for the 320 px
 * side-bar plus a board that frames the example circuits.
 */
export const VIEWPORT = { width: 1280, height: 860 };

/**
 * Narrowest desktop viewport a shot uses — for the ones whose subject spans the
 * whole window, where {@link VIEWPORT} would put a band of empty chrome in the
 * middle. The binding constraint is not the compact breakpoint but the tool
 * bar, which wraps to a second row once its buttons no longer fit; the run
 * controls it ends in are labelled, so where that happens follows the language
 * (measured at 1061 CSS px in English, 1073 in Spanish, 1078 in German and 1109
 * in French). This is the widest of those plus a little headroom, and every
 * language uses it, so the bars are framed the same on every page;
 * `Editor.requireSingleRowToolBar` catches a language that outgrows it.
 */
export const NARROW_VIEWPORT = { width: 1130 };

/** One grid unit in CSS px at zoom 1 — `environment.gridSize`. */
export const GRID_SIZE = 16;

/**
 * Camera zoom for close-up board shots. The editor's zoom ladder is `1.2^n`,
 * and `1.2^3` is the step whose apparent circuit size matches the existing doc
 * images. Pinning it (instead of fitting each circuit) keeps a gate the same
 * size on every page.
 */
export const BOARD_ZOOM = 1.2 ** 3;

/** Where the editor persists the interface language (`provideTranslocoPersistLang`). */
export const LANG_STORAGE_KEY = 'logigator.transloco.lang';

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
