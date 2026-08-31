import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { I18N_DIR } from '../config.mjs';

/**
 * The editor's own translations, loaded straight from `src/i18n/<lang>.ts`, so
 * a reworded label moves the shots with it. Node strips the type annotations
 * and the only imports are `import type`, so the locale files load as they are.
 *
 * They sit outside any package declaring `"type": "module"`, which Node reports
 * as a typeless module — a warning that would print into the middle of the task
 * list, so that one is dropped here.
 */
process.removeAllListeners('warning');
process.on('warning', (warning) => {
  if (warning.code !== 'MODULE_TYPELESS_PACKAGE_JSON') console.warn(warning);
});

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
