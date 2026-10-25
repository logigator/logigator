import { isDeepStrictEqual } from 'node:util';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, notInArray, sql } from 'drizzle-orm';
import { EXAMPLES_ACCOUNT_ID, type LanguageId } from '@logigator/core';
import {
  DB,
  type Database,
  type Transaction
} from '../database/database.module';
import {
  components,
  projects,
  users,
  type ComponentRow,
  type ProjectRow
} from '../database/schema';
import { CircuitDocumentService } from './circuit-document.service';
import type { CircuitTable } from './circuit-queries';
import { putHumanText, textTableOf } from './document-text-queries';
import {
  COMPONENT_EDGES,
  DependenciesService,
  PROJECT_EDGES
} from './dependencies.service';
import type {
  ExampleAccount,
  ExampleComponent,
  ExampleEntry,
  ExampleProject,
  ExampleSet
} from './example-set';
import { PreviewService } from './preview.service';

/** What one run did to one document. */
export interface SeedReport {
  kind: 'component' | 'project';
  slug: string;
  document: 'created' | 'updated' | 'unchanged';
  preview: 'written' | 'kept';
}

export interface SeedOptions {
  /**
   * Re-uploads every preview, for a capture run that re-rendered documents
   * which did not change. A preview is otherwise written only with its
   * document, or where the row has none.
   */
  previews?: boolean;
}

/** How far apart the projects' edit times are stamped, in list order. */
const LIST_ORDER_STEP_MS = 1000;

/**
 * Writes the checked-in examples into the seed account: the site's examples
 * page and home page list that account's public projects, so this is what puts
 * content behind them on a database nobody has edited. The community browse
 * listings leave the account out, so being public puts an example in the
 * sitemap and its page in an index without making it community work.
 *
 * The manifest is the source of truth, and a run makes the rows match it:
 *
 * - **Every document goes through `CircuitDocumentService.ingest`**, so a seeded
 *   row is parsed, normalized and derived exactly like a saved one, and its
 *   dependency edges are re-extracted rather than stated.
 * - **Idempotent.** A row whose name, description, visibility, symbol and
 *   document already match is left alone — no version bump, no new preview
 *   asset — so a second run writes nothing. The same holds for its texts.
 * - **The other languages are human versions**, written as an author's are,
 *   and a language the manifest no longer has is removed. The original's
 *   language is the manifest's, set together with the digest it is for, so
 *   no seeded row is ever pending translation: the examples have a human
 *   version in every language, and no reader is offered a machine one.
 * - **An edit is a version bump**, as a save is, so an editor holding an older
 *   copy is told; a visibility change alone is not, as through the API.
 * - **The manifest order is the listing order.** The listings run down the edit
 *   time, so a run that writes any project restamps all of them in order;
 *   otherwise editing the fourth example would move it to the top.
 * - **The account's name and address follow the manifest; nothing else does.**
 *   It is created verified and with no credential at all, so nobody signs in
 *   as it and nothing sweeps it as an abandoned registration, and a run never
 *   touches a credential or a profile field somebody set on it since.
 *
 * Rows the account holds beyond the manifest are reported, not deleted.
 */
@Injectable()
export class SeedExamplesService {
  private readonly logger = new Logger('SeedExamples');

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly documents: CircuitDocumentService,
    private readonly dependencies: DependenciesService,
    private readonly previews: PreviewService
  ) {}

  async run(set: ExampleSet, options: SeedOptions = {}): Promise<SeedReport[]> {
    const now = Date.now();
    await this.ensureAccount(set.account);
    const owner = EXAMPLES_ACCOUNT_ID;

    const report: SeedReport[] = [];
    for (const component of set.components) {
      report.push(
        await this.seedComponent(owner, component, new Date(now), options)
      );
    }
    const stamps = set.projects.map(
      (_, index) => new Date(now - index * LIST_ORDER_STEP_MS)
    );
    for (const [index, project] of set.projects.entries()) {
      report.push(
        await this.seedProject(owner, project, stamps[index], options)
      );
    }

    if (
      report.some(
        (row) => row.kind === 'project' && row.document !== 'unchanged'
      )
    ) {
      await this.restampProjects(set.projects, stamps);
    }
    await this.reportStrays(set);
    return report;
  }

  private async ensureAccount(account: ExampleAccount): Promise<void> {
    await this.db
      .insert(users)
      .values({
        id: EXAMPLES_ACCOUNT_ID,
        username: account.username,
        email: account.email,
        emailVerified: true
      })
      .onConflictDoUpdate({
        target: users.id,
        set: { username: account.username, email: account.email }
      });
  }

  private async seedProject(
    owner: string,
    example: ExampleProject,
    editedAt: Date,
    options: SeedOptions
  ): Promise<SeedReport> {
    const ingested = this.documents.ingest(example.document, example.name);
    const [existing] = await this.db
      .select()
      .from(projects)
      .where(eq(projects.id, example.id));
    requireOwner(existing, owner, 'Project', example);

    const content = {
      name: example.name,
      description: example.description,
      document: ingested.document,
      formatVersion: ingested.formatVersion,
      componentCount: ingested.componentCount,
      wireCount: ingested.wireCount
    };
    const edited = !existing || !sameContent(existing, content);
    const restated = !!existing && existing.visibility !== example.visibility;
    const textsCurrent =
      !edited && (await this.textsMatch(projects, existing, example));
    const status = documentStatus(
      existing,
      edited || restated || !textsCurrent
    );

    if (status !== 'unchanged') {
      await this.db.transaction(async (tx) => {
        if (existing && (edited || restated)) {
          const [row] = await tx
            .update(projects)
            .set({
              ...content,
              visibility: example.visibility,
              ...(edited
                ? { version: existing.version + 1, lastEditedAt: editedAt }
                : {})
            })
            .where(
              and(
                eq(projects.id, example.id),
                eq(projects.version, existing.version)
              )
            )
            .returning({ id: projects.id });
          if (!row) throw changedWhileSeeding('Project', example);
        } else if (!existing) {
          await tx.insert(projects).values({
            ...content,
            id: example.id,
            link: example.link,
            userId: owner,
            visibility: example.visibility,
            createdAt: example.createdAt,
            lastEditedAt: editedAt
          });
        }
        await this.dependencies.replace(
          tx,
          PROJECT_EDGES,
          example.id,
          ingested.dependencies
        );
        if (!textsCurrent) await writeTexts(tx, projects, owner, example);
      });
    }

    const writePreview =
      edited || !existing?.previewId || options.previews === true;
    if (writePreview) {
      await this.previews.replace(projects, owner, example.id, example.preview);
    }
    return {
      kind: 'project',
      slug: example.slug,
      document: status,
      preview: writePreview ? 'written' : 'kept'
    };
  }

  private async seedComponent(
    owner: string,
    example: ExampleComponent,
    editedAt: Date,
    options: SeedOptions
  ): Promise<SeedReport> {
    const ingested = this.documents.ingest(example.document, example.name);
    const [existing] = await this.db
      .select()
      .from(components)
      .where(eq(components.id, example.id));
    requireOwner(existing, owner, 'Component', example);

    const content = {
      name: example.name,
      description: example.description,
      symbol: example.symbol,
      document: ingested.document,
      formatVersion: ingested.formatVersion,
      componentCount: ingested.componentCount,
      wireCount: ingested.wireCount,
      numInputs: ingested.summary.numInputs,
      numOutputs: ingested.summary.numOutputs,
      labels: ingested.summary.labels
    };
    const edited = !existing || !sameContent(existing, content);
    const restated = !!existing && existing.visibility !== example.visibility;
    const textsCurrent =
      !edited && (await this.textsMatch(components, existing, example));
    const status = documentStatus(
      existing,
      edited || restated || !textsCurrent
    );

    if (status !== 'unchanged') {
      await this.db.transaction(async (tx) => {
        if (existing && (edited || restated)) {
          const [row] = await tx
            .update(components)
            .set({
              ...content,
              visibility: example.visibility,
              ...(edited
                ? { version: existing.version + 1, lastEditedAt: editedAt }
                : {})
            })
            .where(
              and(
                eq(components.id, example.id),
                eq(components.version, existing.version)
              )
            )
            .returning({ id: components.id });
          if (!row) throw changedWhileSeeding('Component', example);
        } else if (!existing) {
          await tx.insert(components).values({
            ...content,
            id: example.id,
            link: example.link,
            userId: owner,
            visibility: example.visibility,
            createdAt: example.createdAt,
            lastEditedAt: editedAt
          });
        }
        await this.dependencies.replace(
          tx,
          COMPONENT_EDGES,
          example.id,
          ingested.dependencies
        );
        if (!textsCurrent) await writeTexts(tx, components, owner, example);
      });
    }

    const writePreview =
      edited || !existing?.previewId || options.previews === true;
    if (writePreview) {
      await this.previews.replace(
        components,
        owner,
        example.id,
        example.preview
      );
    }
    return {
      kind: 'component',
      slug: example.slug,
      document: status,
      preview: writePreview ? 'written' : 'kept'
    };
  }

  /**
   * Whether an unedited row's texts already are what the manifest states: the
   * original's languages for its current digest, and exactly the manifest's
   * human versions, each written against that digest.
   */
  private async textsMatch(
    table: CircuitTable,
    existing: ProjectRow | ComponentRow,
    example: ExampleEntry
  ): Promise<boolean> {
    if (
      existing.nameLanguage !== example.language ||
      existing.descriptionLanguage !== example.language ||
      existing.translatedDigest !== existing.textDigest
    ) {
      return false;
    }

    const texts = textTableOf(table);
    const rows = await this.db
      .select({
        language: texts.language,
        name: texts.name,
        description: texts.description,
        sourceDigest: texts.sourceDigest
      })
      .from(texts)
      .where(and(eq(texts.documentId, existing.id), eq(texts.origin, 'human')));

    return (
      rows.length === Object.keys(example.texts).length &&
      rows.every((row) => {
        const wanted = example.texts[row.language as LanguageId];
        return (
          wanted !== undefined &&
          wanted.name === row.name &&
          wanted.description === row.description &&
          row.sourceDigest === existing.textDigest
        );
      })
    );
  }

  /**
   * Puts the edit times back in manifest order, newest first. Not an edit, so
   * `version` stays: nothing about any document changed.
   */
  private async restampProjects(
    examples: readonly ExampleProject[],
    stamps: readonly Date[]
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      for (const [index, example] of examples.entries()) {
        await tx
          .update(projects)
          .set({ lastEditedAt: stamps[index] })
          .where(eq(projects.id, example.id));
      }
    });
  }

  /**
   * Names what the account holds that the manifest does not, which a run
   * leaves in place: deleting a document because a file went missing from a
   * checkout is not a call a seed gets to make.
   */
  private async reportStrays(set: ExampleSet): Promise<void> {
    const owner = EXAMPLES_ACCOUNT_ID;
    const [strayProjects, strayComponents] = await Promise.all([
      this.db
        .select({ id: projects.id, name: projects.name })
        .from(projects)
        .where(
          and(
            eq(projects.userId, owner),
            notInArray(
              projects.id,
              set.projects.map((example) => example.id)
            )
          )
        ),
      this.db
        .select({ id: components.id, name: components.name })
        .from(components)
        .where(
          and(
            eq(components.userId, owner),
            notInArray(
              components.id,
              set.components.map((example) => example.id)
            )
          )
        )
    ]);
    for (const row of [...strayProjects, ...strayComponents]) {
      this.logger.warn(
        `${row.id} ("${row.name}") belongs to the seed account but is not in the manifest; left as it is`
      );
    }
  }
}

/**
 * Makes a row's texts what the manifest states, after its name and description
 * are written: the human versions through the author's own upsert, so each is
 * stamped with the digest of the text just written, and the languages with the
 * digest the row now holds, read in the statement that sets them.
 */
async function writeTexts(
  tx: Transaction,
  table: CircuitTable,
  owner: string,
  example: ExampleEntry
): Promise<void> {
  const texts = textTableOf(table);
  const languages = Object.keys(example.texts);
  await tx
    .delete(texts)
    .where(
      and(
        eq(texts.documentId, example.id),
        eq(texts.origin, 'human'),
        languages.length > 0 ? notInArray(texts.language, languages) : undefined
      )
    );

  for (const [language, version] of Object.entries(example.texts)) {
    await putHumanText(tx, table, owner, example.id, language as LanguageId, {
      name: version.name ?? undefined,
      description: version.description ?? undefined
    });
  }

  await tx
    .update(table)
    .set({
      nameLanguage: example.language,
      descriptionLanguage: example.language,
      translatedDigest: sql`${table.textDigest}`
    })
    .where(eq(table.id, example.id));
}

/** The columns a run compares; the derived ones follow from the document. */
interface SeededContent {
  name: string;
  description: string;
  symbol?: string;
  document: object;
}

/**
 * Whether the row already holds this content. The document is compared as
 * JSON: `jsonb` reorders an object's keys and drops none, while an ingested
 * document may carry `undefined` members a stored one cannot have.
 */
function sameContent(row: SeededContent, content: SeededContent): boolean {
  return (
    row.name === content.name &&
    row.description === content.description &&
    row.symbol === content.symbol &&
    isDeepStrictEqual(asJson(row.document), asJson(content.document))
  );
}

function asJson(value: object): unknown {
  return JSON.parse(JSON.stringify(value));
}

function documentStatus(
  existing: unknown,
  changed: boolean
): SeedReport['document'] {
  if (!existing) return 'created';
  return changed ? 'updated' : 'unchanged';
}

/**
 * A fixed id somebody else's row already carries is a collision the seed must
 * not paper over by writing into another member's document.
 */
function requireOwner(
  existing: { userId: string } | undefined,
  owner: string,
  kind: 'Project' | 'Component',
  example: { id: string; slug: string }
): void {
  if (existing && existing.userId !== owner) {
    throw new Error(
      `${kind} ${example.id} ("${example.slug}") belongs to another account`
    );
  }
}

function changedWhileSeeding(
  kind: 'Project' | 'Component',
  example: { slug: string }
): Error {
  return new Error(`${kind} "${example.slug}" was saved while seeding`);
}
