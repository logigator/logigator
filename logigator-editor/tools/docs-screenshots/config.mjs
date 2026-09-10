import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Circuit files the scenes are built from — plain editor exports, one per
 * scene. Edit one by opening it in the editor and exporting it back over
 * itself; the coordinates are delta-encoded and must not be hand-edited.
 */
export const CIRCUITS_DIR = path.join(here, 'circuits');

/** The editor's translations, which every matched label resolves out of. */
export const I18N_DIR = path.join(here, '..', '..', 'src', 'i18n');

/**
 * The languages the editor ships, in capture order. English comes first: the
 * others are compared against it, and a byte-identical capture is not written
 * at all — the documentation falls back to the English picture.
 */
export const LOCALES = ['en', 'de', 'fr', 'es'];

export const DEFAULT_BASE_URL = 'http://localhost:4200/editor';

/**
 * "200% zoom": two device pixels per CSS pixel, so the canvas (PixiJS
 * resolution follows `devicePixelRatio`) and the DOM chrome both come out at
 * 2×. Playwright clips stay in CSS px; the renderer applies the scale.
 */
export const DEVICE_SCALE_FACTOR = 2;

/**
 * Desktop viewport. Clears the compact breakpoint (`max-width: 64rem`) with
 * room for the 320 px side-bar plus a board framing the example circuits.
 */
export const VIEWPORT = { width: 1280, height: 860 };

/**
 * Narrowest desktop viewport, for shots whose subject spans the whole window.
 * The binding constraint is the tool bar wrapping to a second row, not the
 * compact breakpoint: its run controls are labelled, so the wrap point follows
 * the language (1061 CSS px in English up to 1109 in French). This is the
 * widest of those plus headroom, shared by every language so the bars frame
 * alike; `Editor.requireSingleRowToolBar` catches one that outgrows it.
 */
export const NARROW_VIEWPORT = { width: 1130 };

/** One grid unit in CSS px at zoom 1 — `environment.gridSize`. */
export const GRID_SIZE = 16;

/**
 * Camera zoom for close-up board shots — a step on the editor's `1.2^n` ladder.
 * Pinned rather than fitted per circuit, so a gate is the same size on every
 * page.
 */
export const BOARD_ZOOM = 1.2 ** 3;

/** Where the editor persists the interface language. */
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
