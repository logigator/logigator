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
import type { PreviewSources } from './preview-upload';

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
  name: documentNameSchema,
  description: documentDescriptionSchema,
  visibility: documentVisibilitySchema,
  createdAt: z.coerce.date()
});

const exampleManifestSchema = z.object({
  /** Its id is core's `EXAMPLES_ACCOUNT_ID`, which the site reads too. */
  account: z.object({
    username: usernameSchema,
    email: emailSchema
  }),
  /** Seeded first, so a project's edges find the masters it embeds. */
  components: z.array(
    exampleEntrySchema.extend({ symbol: componentSymbolSchema })
  ),
  /** In the order the examples are listed, which the seed stamps on them. */
  projects: z.array(exampleEntrySchema)
});

type ExampleEntry = z.infer<typeof exampleEntrySchema>;

/** A seeded document with its files read. */
export type Example<E = ExampleEntry> = E & {
  document: object;
  preview: PreviewSources;
};

export type ExampleAccount = z.infer<typeof exampleManifestSchema>['account'];
export type ExampleComponent = Example<
  z.infer<typeof exampleManifestSchema>['components'][number]
>;
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
  const manifest = exampleManifestSchema.parse(
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
