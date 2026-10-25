import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import * as z from 'zod';
import {
  componentSymbolSchema,
  documentDescriptionSchema,
  documentNameSchema,
  documentVisibilitySchema,
  emailSchema,
  usernameSchema
} from '@logigator/contract';
import { type Locale, LOCALES } from '../common/locale';
import type { PreviewSources } from './preview-upload';

const localeSchema = z.enum(LOCALES);

/**
 * A field written once, or per site language. Every language is held to the
 * limits of the original, so a seed never writes a text the API would refuse
 * from an author.
 */
const textSchema = <S extends z.ZodType<string>>(text: S) =>
  z.union([text, z.partialRecord(localeSchema, text)]);

/**
 * One seeded document as the manifest states it. The id and the link are
 * fixed rather than minted, so a re-run finds the row it wrote, and an address
 * the legacy site handed out for the same example keeps resolving.
 */
const exampleEntrySchema = z.object({
  /** Names the document's files: `<slug>.json`, `<slug>-light.webp`, `-dark`. */
  slug: z.string().regex(/^[a-z0-9-]+$/),
  id: z.string().uuid(),
  link: z.string().uuid(),
  /** What the original is written in; the other languages are human versions. */
  language: localeSchema,
  name: textSchema(documentNameSchema),
  description: textSchema(documentDescriptionSchema),
  visibility: documentVisibilitySchema,
  createdAt: z.coerce.date()
});

/** One language's human version of an example; null where a field has none. */
export interface ExampleTextVersion {
  name: string | null;
  description: string | null;
}

/** The human versions of an example, keyed by every language but the original's. */
export type ExampleTexts = Partial<Record<Locale, ExampleTextVersion>>;

type ResolvedTexts<E> = Omit<E, 'name' | 'description'> & {
  name: string;
  description: string;
  texts: ExampleTexts;
};

/**
 * Splits an entry's texts into the original, which stays in `name` and
 * `description` as every document carries it, and the human versions beside
 * it. A field written once is in the original's language.
 */
const withTexts = <E extends z.output<typeof exampleEntrySchema>>(
  schema: z.ZodType<E>
) =>
  schema.transform((entry, ctx): ResolvedTexts<E> => {
    const inLanguages = (text: E['name']): Partial<Record<Locale, string>> =>
      typeof text === 'string' ? { [entry.language]: text } : text;
    const names = inLanguages(entry.name);
    const descriptions = inLanguages(entry.description);

    const name = names[entry.language];
    const description = descriptions[entry.language];
    for (const [field, original] of [
      ['name', name],
      ['description', description]
    ] as const) {
      if (original === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: [field],
          message: `Has no text in the original's language "${entry.language}".`
        });
      }
    }
    if (name === undefined || description === undefined) {
      return z.NEVER;
    }

    const texts: ExampleTexts = {};
    for (const locale of LOCALES) {
      const version = {
        name: names[locale] ?? null,
        description: descriptions[locale] ?? null
      };
      if (
        locale !== entry.language &&
        (version.name !== null || version.description !== null)
      ) {
        texts[locale] = version;
      }
    }
    return { ...entry, name, description, texts };
  });

const exampleManifestSchema = z.object({
  /** Its id is core's `EXAMPLES_ACCOUNT_ID`, which the site reads too. */
  account: z.object({
    username: usernameSchema,
    email: emailSchema
  }),
  /** Seeded first, so a project's edges find the masters it embeds. */
  components: z.array(
    withTexts(exampleEntrySchema.extend({ symbol: componentSymbolSchema }))
  ),
  /** In the order the examples are listed, which the seed stamps on them. */
  projects: z.array(withTexts(exampleEntrySchema))
});

export type ExampleManifest = z.output<typeof exampleManifestSchema>;

/** A manifest entry with its texts resolved. */
export type ExampleEntry = ExampleManifest['projects'][number];

/** A seeded document with its files read. */
export type Example<E = ExampleEntry> = E & {
  document: object;
  preview: PreviewSources;
};

export type ExampleAccount = ExampleManifest['account'];
export type ExampleComponent = Example<ExampleManifest['components'][number]>;
export type ExampleProject = Example;

export interface ExampleSet {
  account: ExampleAccount;
  components: ExampleComponent[];
  projects: ExampleProject[];
}

/**
 * The checked-in examples, as the running process sees them: `examples/` is
 * copied next to the bundle like the migrations are. Specs run from source and
 * pass the package's own folder instead.
 */
export function defaultExamplesFolder(): string {
  return join(import.meta.dirname, 'examples');
}

/**
 * Reads the manifest and every file it names, refusing the set whole if any is
 * missing: a seed that wrote half the examples would list a different set than
 * the one checked in. The documents themselves are only parsed as JSON here —
 * the format has its own validator, which the write path runs.
 */
export async function loadExampleSet(folder: string): Promise<ExampleSet> {
  const manifest = parseExampleManifest(
    JSON.parse(await readFile(join(folder, 'examples.json'), 'utf8'))
  );
  const withFiles = <E extends ExampleEntry>(entry: E) =>
    readExampleFiles(folder, entry);

  return {
    account: manifest.account,
    components: await Promise.all(manifest.components.map(withFiles)),
    projects: await Promise.all(manifest.projects.map(withFiles))
  };
}

export function parseExampleManifest(value: unknown): ExampleManifest {
  return exampleManifestSchema.parse(value);
}

async function readExampleFiles<E extends ExampleEntry>(
  folder: string,
  entry: E
): Promise<Example<E>> {
  const file = (suffix: string) => join(folder, `${entry.slug}${suffix}`);
  const [document, light, dark] = await Promise.all([
    readFile(file('.json'), 'utf8').then((text) => JSON.parse(text) as object),
    readFile(file('-light.webp')),
    readFile(file('-dark.webp'))
  ]).catch((error: unknown) => {
    throw new Error(
      `Example "${entry.slug}" is incomplete: ${describe(error)}. Its previews ` +
        'come from the capture tool: `yarn capture examples ../../../logigator-api` ' +
        'from logigator-editor/tools/screenshots.',
      { cause: error }
    );
  });
  return { ...entry, document, preview: { light, dark } };
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
