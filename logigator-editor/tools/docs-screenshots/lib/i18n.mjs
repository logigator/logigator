import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { I18N_DIR } from '../config.mjs';

/**
 * The editor's own translations, loaded straight from `src/i18n/<lang>.ts`.
 *
 * Every label this tool matches on — menu items, dialog tabs, the buttons a
 * shot clicks — is addressed by its translation key and resolved here, so a
 * localized run reads the same strings the editor renders instead of a table
 * out here that would drift the moment one of them was reworded.
 *
 * Node strips the type annotations, so the locale files load as they are; their
 * only imports are `import type`, which erase. The files sit outside any
 * package declaring `"type": "module"`, which Node reports as a typeless
 * module — a warning that would print into the middle of the task list, so it
 * is dropped (and only that one) here.
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
 * does not resolve to a string is an error rather than an empty selector: the
 * shot would otherwise fail on a missing element, several steps later.
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
