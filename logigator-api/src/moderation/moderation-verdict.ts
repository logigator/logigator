/**
 * What the model says about a document's name and description against the
 * site's rules: the report reasons a text alone can show, `copyright` not
 * among them, or `none`.
 */
export const MODERATION_CATEGORIES = [
  'none',
  'illegal',
  'harassment',
  'personal_data',
  'spam',
  'other'
] as const;

export type ModerationCategory = (typeof MODERATION_CATEGORIES)[number];

/**
 * The categories a certain verdict hides at once; every other verdict only
 * opens a report.
 */
export const SEVERE_CATEGORIES: readonly ModerationCategory[] = [
  'illegal',
  'harassment',
  'personal_data'
];

/**
 * One reply's moderation verdict. `certain` means the text leaves no
 * reasonable harmless reading. `note` is the model's own words over text an
 * author controls, so it is for the moderator alone and never shown to the
 * owner or a reader.
 */
export interface ModerationVerdict {
  category: ModerationCategory;
  certain: boolean;
  note: string;
}

/**
 * The verdict a declined reply stands for, when the provider's filter or the
 * model itself refused the text. It names no category, so it is never
 * certain: it puts the text in front of a person and hides nothing.
 */
export const BLOCKED_VERDICT: ModerationVerdict = {
  category: 'other',
  certain: false,
  note: 'The provider filtered the reply or the model refused the text, so no verdict was given.'
};

/**
 * Whether `next` is the stricter verdict: a severe category over a mild one
 * over `none`, and within a tier a certain verdict over one that is not. On a
 * tie the verdict already kept stays.
 */
export function isStricter(
  next: ModerationVerdict,
  kept: ModerationVerdict | null
): boolean {
  return kept === null || strictness(next) > strictness(kept);
}

function strictness(verdict: ModerationVerdict): number {
  if (verdict.category === 'none') return 0;
  const tier = SEVERE_CATEGORIES.includes(verdict.category) ? 2 : 1;
  return tier * 2 + (verdict.certain ? 1 : 0);
}
