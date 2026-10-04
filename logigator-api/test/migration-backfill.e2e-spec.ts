import { copyFile, mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { runMigrations } from '../src/database/migrate';
import { readLocalMigrations } from '../src/database/migration-state';
import {
  createThrowawayDatabase,
  MIGRATIONS_FOLDER_PATH,
  type ThrowawayDatabase
} from './harness';

/**
 * The backfill that turns `public` into `visibility`, which nothing running
 * against the current schema can reach: by the time the application can talk to
 * the database, the column it reads is gone. So the schema is staged *behind*
 * the migration under test — every migration before it, applied — rows are
 * written in the shape the boolean left them in, and the rest of the history is
 * applied over them.
 *
 * What it is for is the promise the migration makes: a link somebody was handed
 * before this change goes on resolving afterwards. A published document that
 * came out `unlisted` keeps its URL, and *no longer resolves for a stranger*
 * the moment its owner's intent was to publish it — which is a failure nobody
 * would see until a shared link answered `404`.
 */
describe('the visibility backfill', () => {
  let database: ThrowawayDatabase | undefined;

  afterEach(async () => {
    await database?.drop();
    database = undefined;
  });

  /**
   * The checked-in migrations up to the one that adds `visibility`, staged into
   * a folder of their own. The boundary is found in the SQL rather than assumed
   * to be the newest migration: a migration added after this one would
   * otherwise become the split point, and the spec would fail over a stage that
   * never happened rather than over the state it missed.
   */
  async function migrationsBeforeVisibility(): Promise<string> {
    const folder = await mkdtemp(join(tmpdir(), 'logigator-migrations-'));

    for (const { name } of readLocalMigrations(MIGRATIONS_FOLDER_PATH)) {
      const migration = join(MIGRATIONS_FOLDER_PATH, name, 'migration.sql');
      const text = await readFile(migration, 'utf8');
      if (text.includes('ADD COLUMN "visibility"')) return folder;

      await mkdir(join(folder, name));
      await copyFile(migration, join(folder, name, 'migration.sql'));
    }

    throw new Error(
      'No checked-in migration adds `visibility`. The backfill it carries has moved elsewhere, so this spec no longer tests it.'
    );
  }

  /** One connection over the staged database, closed however the block ends. */
  async function withClient<T>(
    url: string,
    body: (client: Client) => Promise<T>
  ): Promise<T> {
    const client = new Client({ connectionString: url });
    await client.connect();
    try {
      return await body(client);
    } finally {
      await client.end();
    }
  }

  it('keeps a published link resolving, and leaves an unpublished one unlisted', async () => {
    database = await createThrowawayDatabase();
    await runMigrations(database.url, await migrationsBeforeVisibility());

    const { publishedLink, unpublishedLink } = await withClient(
      database.url,
      async (client) => {
        // A document the way it was stored under the boolean: `document` and
        // `format_version` are the two columns with no default, and the name
        // and the user are here so the rows read like real ones.
        const owner = await client.query<{ id: string }>(
          `insert into "users" ("username", "email") values ('Ada', 'ada@example.com') returning id`
        );
        const insert = (name: string, isPublic: boolean) =>
          client.query<{ link: string }>(
            `insert into "projects" ("user_id", "name", "document", "format_version", "public")
             values ($1, $2, '{}'::jsonb, 1, $3)
             returning "link"`,
            [owner.rows[0].id, name, isPublic]
          );

        const published = await insert('Published back then', true);
        const unpublished = await insert('Handed around', false);
        return {
          publishedLink: published.rows[0].link,
          unpublishedLink: unpublished.rows[0].link
        };
      }
    );

    await runMigrations(database.url, MIGRATIONS_FOLDER_PATH);

    const rows = await withClient(database.url, async (client) =>
      client.query<{ name: string; visibility: string; link: string }>(
        `select "name", "visibility", "link" from "projects" order by "name"`
      )
    );

    expect(rows.rows).toEqual([
      {
        name: 'Handed around',
        // The boolean's `false`: the link resolved and nothing was listed.
        visibility: 'unlisted',
        link: unpublishedLink
      },
      {
        name: 'Published back then',
        // The boolean's `true`, which is what keeps a handed-out link to a
        // published document agreeing with the listing it is in.
        visibility: 'public',
        link: publishedLink
      }
    ]);
  });

  it('stores the three states and nothing else', async () => {
    database = await createThrowawayDatabase();
    await runMigrations(database.url, MIGRATIONS_FOLDER_PATH);

    // The type the migration creates is the constraint: a row written straight
    // at the table — by a psql session, by whatever writes rows here next — is
    // held to it, and the name in the failure is the type's. That is the whole
    // of what the enum is for.
    await expect(
      withClient(database.url, async (client) => {
        const owner = await client.query<{ id: string }>(
          `insert into "users" ("username", "email") values ('Ada', 'ada@example.com') returning id`
        );
        await client.query(
          `insert into "projects" ("user_id", "name", "document", "format_version", "visibility")
           values ($1, 'Smuggled', '{}'::jsonb, 1, 'everyone')`,
          [owner.rows[0].id]
        );
      })
    ).rejects.toThrow(/document_visibility/);

    // And the other half of "the type is the definition": a state added to the
    // enum would be storable here, so this reads the labels back the way
    // `pg_enum` holds them, which is what a later migration extends.
    const states = await withClient(database.url, (client) =>
      client.query<{ label: string }>(
        `select e.enumlabel as label
           from pg_enum e
           join pg_type t on t.oid = e.enumtypid
          where t.typname = 'document_visibility'
          order by e.enumsortorder`
      )
    );
    expect(states.rows.map(({ label }) => label)).toEqual([
      'private',
      'unlisted',
      'public'
    ]);
  });
});
