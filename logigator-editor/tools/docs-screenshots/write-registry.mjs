#!/usr/bin/env node
/**
 * Rewrites `src/app/documentation/docs-images.ts` from what is on disk under
 * `src/assets/docs/<lang>/images/`. Run it after copying a capture into the
 * tree.
 *
 *   node tools/docs-screenshots/write-registry.mjs
 *
 * Which pictures a language has is decided by the run, so the registry follows
 * the folders rather than a hand-kept list.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCALES } from './config.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, '..', '..', 'src');
const REGISTRY = path.join(SRC, 'app/documentation/docs-images.ts');

/** `menu-bar.png` in `de` → `menuBarDe`, the import name for one picture. */
function ident(lang, file) {
  const name = path
    .parse(file)
    .name.replace(/-([a-z0-9])/g, (_, char) => char.toUpperCase());
  return `${name}${lang[0].toUpperCase()}${lang.slice(1)}`;
}

const groups = LOCALES.map((lang) => {
  const dir = path.join(SRC, 'assets/docs', lang, 'images');
  const files = fs.existsSync(dir)
    ? fs
        .readdirSync(dir)
        .filter((file) => /\.(png|gif)$/.test(file))
        .sort()
    : [];
  return { lang, files };
}).filter((group) => group.files.length > 0);

const imports = groups
  .flatMap(({ lang, files }) =>
    files.map(
      (file) =>
        `import ${ident(lang, file)} from '@assets/docs/${lang}/images/${file}';`
    )
  )
  .join('\n');

const maps = groups
  .map(({ lang, files }) => {
    const entries = files
      .map((file) => `  './images/${file}': ${ident(lang, file)}`)
      .join(',\n');
    return `const ${lang}: Readonly<Record<string, string>> = {\n${entries}\n};`;
  })
  .join('\n\n');

const source = `${imports}

/** One language's screenshots, keyed by the destination the markdown uses. */
${maps}

/**
 * Documentation screenshots per language, each keyed by the destination string
 * authored in that language's page markdown (\`./images/…\`, relative to the
 * page's folder). Every import resolves to the build's cache-busted URL for
 * that file — the image file loader, the same scheme \`DOC_SECTIONS\` uses for
 * the pages themselves — so rendering swaps the authored destination for the
 * hashed URL.
 *
 * Screenshots of the board carry no interface text and are captured once, in
 * English; only the ones showing localized chrome are shot per language, and
 * \`docImages\` falls back per key, so a language lists exactly the pictures that
 * differ from the English ones.
 *
 * Generated from the image folders by \`tools/docs-screenshots/write-registry.mjs\`
 * — add a picture by dropping it under \`src/assets/docs/<lang>/images/\` and
 * running that, not by editing this file.
 */
export const DOC_IMAGES: Readonly<
  Record<string, Readonly<Record<string, string>>>
> = { ${groups.map((group) => group.lang).join(', ')} };

/**
 * The screenshots a language renders with: its own where it has them, English
 * everywhere else.
 */
export function docImages(lang: string): Readonly<Record<string, string>> {
  const localized = DOC_IMAGES[lang];
  return localized ? { ...DOC_IMAGES['en'], ...localized } : DOC_IMAGES['en'];
}
`;

fs.writeFileSync(REGISTRY, source);
console.log(
  `${groups.map((group) => `${group.lang}: ${group.files.length}`).join('  ')} → ${path.relative(process.cwd(), REGISTRY)}`
);
