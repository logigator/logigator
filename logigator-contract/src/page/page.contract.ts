import { z } from 'zod';

/**
 * The query every listing endpoint accepts.
 *
 * Coerced rather than parsed by hand because query parameters arrive as strings,
 * and defaulted so a bare `GET` is a valid first page. `size` is capped: the
 * caller chooses the page, never how much work the server does — the legacy
 * ceiling of a thousand rows per request was a page size nothing asked for and
 * every listing had to be able to serve.
 */
export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(0).default(0),
  size: z.coerce.number().int().min(1).max(100).default(20),
  /** Case-insensitive substring of the name. */
  search: z.string().trim().max(100).optional()
});

export type PageQuery = z.infer<typeof pageQuerySchema>;

/**
 * One page of results.
 *
 * `total` is the number of matching rows, not of pages — the legacy `Page<T>`
 * called the page count `total` and the row count nothing, so every consumer
 * had to know which one it was looking at. A client that wants the page count
 * divides; a client that wants to render "42 results" can.
 */
export interface Page<T> {
  entries: T[];
  page: number;
  pageSize: number;
  total: number;
}

/** The page envelope around an entry schema. */
export function pageSchema<TEntry extends z.ZodType>(entry: TEntry) {
  return z
    .object({
      entries: z.array(entry),
      page: z.number().int().nonnegative(),
      pageSize: z.number().int().positive(),
      total: z.number().int().nonnegative()
    })
    .loose();
}
