import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { EXAMPLES_ACCOUNT_ID } from '@logigator/core';
import { ApiException } from '../common/api-exception';
import { ENV, type Env } from '../config/env';
import type { Transaction } from '../database/database.module';
import { components, projects, users } from '../database/schema';

/**
 * The storage quota: how many bytes of documents and previews one account's
 * projects and components may hold together.
 *
 * Usage is summed from the rows' own `document_bytes` and `preview_bytes`
 * rather than kept as a running total, so there is no count that a delete, a
 * cascade or a re-normalization could leave wrong.
 *
 * Two guarded writes of one account must not both pass a check that each would
 * pass alone, so the guard takes the account's row lock before it sums and
 * holds it to the commit. That makes the sum before the write a fact for as
 * long as the write is undecided: every write that can grow an account's usage
 * waits for it. `FOR NO KEY UPDATE`, which the foreign-key checks of other
 * inserts do not wait for.
 *
 * Only growth is refused. An account can be over its quota, after the limit is
 * lowered or from a legacy import, and saving something smaller or deleting
 * has to stay open to it, or it could never get back under.
 */
@Injectable()
export class StorageQuotaService {
  constructor(@Inject(ENV) private readonly env: Env) {}

  /**
   * Runs `write` inside `tx` and refuses it, rolling the transaction back, when
   * it grew the account's usage past the quota. The examples account is the
   * site's own and holds whatever the examples need.
   */
  async guard<T>(
    tx: Transaction,
    userId: string,
    write: () => Promise<T>
  ): Promise<T> {
    if (userId === EXAMPLES_ACCOUNT_ID) return write();

    await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .for('no key update');

    const before = await usageOf(tx, userId);
    const result = await write();
    const after = await usageOf(tx, userId);

    if (after > before && after > this.env.STORAGE_QUOTA_BYTES) {
      throw storageFull();
    }
    return result;
  }
}

/** Bytes an account's documents and previews hold. */
async function usageOf(tx: Transaction, userId: string): Promise<number> {
  const result = await tx.execute<{ bytes: string }>(sql`
    SELECT (SELECT coalesce(sum(${projects.documentBytes} + ${projects.previewBytes}), 0)
              FROM ${projects} WHERE ${projects.userId} = ${userId})
         + (SELECT coalesce(sum(${components.documentBytes} + ${components.previewBytes}), 0)
              FROM ${components} WHERE ${components.userId} = ${userId})
           AS bytes
  `);
  return Number(result.rows[0].bytes);
}

/**
 * `403` rather than `413`: the request is not too large, the account is too
 * full, and deleting documents is what the client should suggest.
 */
export function storageFull(): ApiException {
  return new ApiException(
    HttpStatus.FORBIDDEN,
    'storage_full',
    'Your cloud storage is full. Delete projects or components to make room.'
  );
}
