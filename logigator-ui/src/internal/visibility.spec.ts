import { describe, expect, it } from 'vitest';
import {
  LG_DOCUMENT_VISIBILITIES,
  canRotateLink,
  hasLiveLink,
  type LgDocumentVisibility
} from './visibility';

/**
 * The whole of what this module is: one row per state, and the two dialogs read
 * the same rows. Written as a table rather than as a set of cases because a
 * state added to the union without a row here would otherwise pass unexamined —
 * the failure mode is silent, an editor showing a link that resolves nothing.
 */
const RULES: Record<
  LgDocumentVisibility,
  { liveLink: boolean; rotatable: boolean }
> = {
  private: { liveLink: false, rotatable: false },
  unlisted: { liveLink: true, rotatable: true },
  public: { liveLink: true, rotatable: false }
};

describe('what each visibility allows its link', () => {
  it('covers every state, in the order the pickers draw them', () => {
    expect(LG_DOCUMENT_VISIBILITIES).toEqual(Object.keys(RULES));
  });

  it.each(LG_DOCUMENT_VISIBILITIES)('%s', (visibility) => {
    expect({
      liveLink: hasLiveLink(visibility),
      rotatable: canRotateLink(visibility)
    }).toEqual(RULES[visibility]);
  });
});
