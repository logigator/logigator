import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
// Installs the typeless-package warning filter this module's imports need.
import './origin.mjs';

/** The editor's translation files — three directories up, then into its `src/`. */
const I18N_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'src',
  'i18n'
);

/**
 * The editor's own translations, loaded straight from `src/i18n/<lang>.ts`, so
 * a reworded label moves the shots with it. Node strips the type annotations
 * and the only imports are `import type`, so the locale files load as they are.
 */

const loaded = new Map();

/** Loads one language's bundle, memoized across the shots that share it. */
export async function loadTranslations(lang) {
  if (!loaded.has(lang)) {
    const file = pathToFileURL(path.join(I18N_DIR, `${lang}.ts`));
    const bundle = await import(file.href).catch(() => {
      throw new Error(`no translations for "${lang}" in ${I18N_DIR}`);
    });
    loaded.set(lang, bundle.default);
  }
  return loaded.get(lang);
}

/**
 * Resolves a dot-notation translation key against a loaded bundle. A key that
 * misses throws here rather than yielding an empty selector that fails the shot
 * several steps later.
 */
export function translate(bundle, key) {
  const value = key
    .split('.')
    .reduce((node, part) => (node == null ? undefined : node[part]), bundle);
  if (typeof value !== 'string') {
    throw new Error(`no translation for "${key}"`);
  }
  return value;
}
