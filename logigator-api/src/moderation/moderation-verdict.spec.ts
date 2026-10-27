import { describe, expect, it } from 'vitest';
import { isStricter, type ModerationVerdict } from './moderation-verdict';

const CLEAN: ModerationVerdict = { category: 'none', certain: false, note: '' };

describe('isStricter', () => {
  it.each<[string, ModerationVerdict, ModerationVerdict, boolean]>([
    [
      'a flag over none',
      { category: 'spam', certain: false, note: 'An ad.' },
      CLEAN,
      true
    ],
    [
      'none over a flag',
      CLEAN,
      { category: 'spam', certain: true, note: 'An ad.' },
      false
    ],
    [
      'a severe category over a mild one, however certain',
      { category: 'illegal', certain: false, note: 'Sells something.' },
      { category: 'spam', certain: true, note: 'An ad.' },
      true
    ],
    [
      'certain over not, within a tier',
      { category: 'personal_data', certain: true, note: 'A home address.' },
      { category: 'harassment', certain: false, note: 'Maybe an insult.' },
      true
    ],
    [
      'an equally strict verdict over the one kept',
      { category: 'spam', certain: false, note: 'Second.' },
      { category: 'other', certain: false, note: 'First.' },
      false
    ]
  ])('%s', (_, next, kept, stricter) => {
    expect(isStricter(next, kept)).toBe(stricter);
  });

  it('takes any verdict when none is kept yet', () => {
    expect(isStricter(CLEAN, null)).toBe(true);
  });
});
