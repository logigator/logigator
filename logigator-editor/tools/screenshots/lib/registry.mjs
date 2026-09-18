import fs from 'node:fs';
import path from 'node:path';

/**
 * The catalogue a target writes after a run: the import map over what it
 * captured, for the app that shows it. This is the half every target does the
 * same way — find the captures, name an import after each, write the file. A
 * target's own registry keeps what is genuinely its own: the key a consumer
 * looks a picture up by, the fallback the consumer needs, and the words around
 * both.
 */

/**
 * Every capture under `dir`, sorted. `[]` for a directory that does not exist
 * yet, which is a target that has not been shot — not an error.
 *
 * WebP is the tool's only output format, so a file that is not one is not a
 * capture and is left out rather than emitted as an import nothing can resolve.
 */
export function captureFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir)
    .filter((file) => /\.webp$/.test(file))
    .sort();
}

/** `menu-bar` → `menuBar`: a dashed name, as the camel-case part of one. */
export function camelCase(stem) {
  return stem
    .split('-')
    .map((part, index) =>
      index === 0 ? part : part[0].toUpperCase() + part.slice(1)
    )
    .join('');
}

/**
 * One `import <ident> from '<specifier>';` per file, in the order given, with
 * `ident` called on each name so the caller owns what distinguishes two files
 * of the same name — a language, or a colour scheme.
 *
 * The specifier is resolved from the registry's own directory, so moving the
 * media folder cannot leave a stale relative path behind.
 */
export function importLines(files, registry, media, ident) {
  const relative = path.relative(path.dirname(registry), media);
  // A sibling directory needs the `./`; one reached by going up does not, and
  // `./../` is a specifier no reader should have to parse.
  const prefix = relative.startsWith('..') ? '' : './';
  return files.map(
    (file) => `import ${ident(file)} from '${prefix}${relative}/${file}';`
  );
}

/** Writes the generated file and reports what went into it. */
export function writeGenerated(registry, source, summary) {
  fs.mkdirSync(path.dirname(registry), { recursive: true });
  fs.writeFileSync(registry, source);
  console.log(summary);
  return registry;
}
