import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pass, Shot } from '../../lib/target.ts';

/**
 * The seed account's documents, as `logigator-api`'s `db:seed-examples` writes
 * them: the manifest names each one by slug, and its document is `<slug>.json`
 * beside it. Read from the API's tree rather than copied into `circuits/`, so
 * the circuit the preview shows is the one the seed stores.
 */
export const EXAMPLES_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
  '..',
  'logigator-api',
  'examples'
);

export const TARGET = {
  /** Driven with `yarn start:editor:prod --define "AUTOMATION_API=true"`. */
  base: 'http://localhost:4200/editor',
  /** The folder the documents are in, which the seed reads the renders from. */
  layout: () => 'examples'
};

/** `basic-gates-dark.webp`: the seed uploads the pair as one preview. */
export function fileName(shot: Shot, pass: Pass): string {
  return `${shot.name}-${pass.theme}.webp`;
}

/** Every slug the manifest names, components first, as the seed writes them. */
export function exampleSlugs(): string[] {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(EXAMPLES_DIR, 'examples.json'), 'utf8')
  ) as { components: { slug: string }[]; projects: { slug: string }[] };
  return [...manifest.components, ...manifest.projects].map(
    (entry) => entry.slug
  );
}

/** One document's native JSON, exactly as the seed hands it to the API. */
export function exampleDocument(slug: string): string {
  return fs.readFileSync(path.join(EXAMPLES_DIR, `${slug}.json`), 'utf8');
}
