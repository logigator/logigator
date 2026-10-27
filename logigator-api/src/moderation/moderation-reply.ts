import * as z from 'zod';
import {
  MODERATION_CATEGORIES,
  type ModerationVerdict
} from './moderation-verdict';

/**
 * The verdict's part of the reply as the model is told it, with no constraint
 * beyond types, for the reason the whole wire schema has none.
 */
export const moderationReplyWireSchema = z.object({
  category: z.string(),
  certain: z.boolean(),
  note: z.string()
});

/** The longest moderation note kept, in characters. */
export const MODERATION_NOTE_MAX_LENGTH = 300;

/** The verdict as it is parsed: the category held to the categories. */
export const moderationReplySchema = z.object({
  category: z.string().trim().toLowerCase().pipe(z.enum(MODERATION_CATEGORIES)),
  certain: z.boolean(),
  // Cut rather than refused: the note only explains the verdict, and a long
  // one is no reason to spend the retry. Cut by code point, so no surrogate
  // pair is split.
  note: z
    .string()
    .trim()
    .transform((note) =>
      Array.from(note).slice(0, MODERATION_NOTE_MAX_LENGTH).join('').trim()
    )
}) satisfies z.ZodType<ModerationVerdict>;
