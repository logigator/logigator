import * as z from 'zod';

/**
 * The query every listing endpoint accepts. Coerced because query parameters
 * arrive as strings, and defaulted so a bare `GET` is a valid first page.
 * `size` is capped: the caller chooses the page, never how much work the server
 * does.
 */
export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(0).default(0),
  size: z.coerce.number().int().min(1).max(100).default(20),
  /** Case-insensitive substring of the name. */
  search: z.string().trim().max(100).optional()
});

export type PageQuery = z.infer<typeof pageQuerySchema>;

/** One page of results. `total` counts matching rows, not pages. */
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
