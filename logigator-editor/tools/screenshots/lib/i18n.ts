import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { TranslationKey } from '../../../src/app/translation/translation-key.model.ts';
import type { TranslationSchema } from '../../../src/app/translation/translation-schema.model.ts';
import type { LanguageId } from './origin.ts';
// Installs the typeless-package warning filter the locale imports need.
import './runtime.ts';

export type { TranslationKey, TranslationSchema };

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
 *
 * The keys are the editor's own `TranslationKey`, so a key that no longer
 * exists is a type error before it is a failed shot.
 */

const loaded = new Map<LanguageId, TranslationSchema>();

/** Loads one language's bundle, memoized across the shots that share it. */
export async function loadTranslations(
  lang: LanguageId
): Promise<TranslationSchema> {
  let bundle = loaded.get(lang);
  if (!bundle) {
    const file = pathToFileURL(path.join(I18N_DIR, `${lang}.ts`));
    const module = (await import(file.href).catch(() => {
      throw new Error(`no translations for "${lang}" in ${I18N_DIR}`);
    })) as { default: TranslationSchema };
    bundle = module.default;
    loaded.set(lang, bundle);
  }
  return bundle;
}

/**
 * Resolves a dot-notation translation key against a loaded bundle. A key that
 * misses throws here rather than yielding an empty selector that fails the shot
 * several steps later.
 */
export function translate(
  bundle: TranslationSchema,
  key: TranslationKey
): string {
  const value = key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node == null ? undefined : (node as Record<string, unknown>)[part],
      bundle
    );
  if (typeof value !== 'string') {
    throw new Error(`no translation for "${key}"`);
  }
  return value;
}
