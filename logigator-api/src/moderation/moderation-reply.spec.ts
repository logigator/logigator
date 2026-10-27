import { describe, expect, it } from 'vitest';
import {
  MODERATION_NOTE_MAX_LENGTH,
  moderationReplySchema
} from './moderation-reply';

describe('moderationReplySchema', () => {
  it('refuses a category that is not one of the categories', () => {
    expect(
      moderationReplySchema.safeParse({
        category: 'hate',
        certain: true,
        note: ''
      }).success
    ).toBe(false);
  });

  it('reads the category in any case, and trims and cuts the note', () => {
    expect(
      moderationReplySchema.parse({
        category: ' Personal_Data ',
        certain: false,
        note: `  ${'x'.repeat(MODERATION_NOTE_MAX_LENGTH)}🙂`
      })
    ).toEqual({
      category: 'personal_data',
      certain: false,
      note: 'x'.repeat(MODERATION_NOTE_MAX_LENGTH)
    });
  });
});
