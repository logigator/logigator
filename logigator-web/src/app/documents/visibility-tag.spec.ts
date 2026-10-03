import { beforeEach, describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  LG_DOCUMENT_VISIBILITIES,
  type LgDocumentVisibility
} from '@logigator/ui';
import { configureTestBed } from '../../testing/configure-test-bed';
import { TranslationService } from '../translation/translation.service';
import { VisibilityTag } from './visibility-tag';

/**
 * What each state is called. Three rows rather than three cases: a state added
 * to the union without a word here is a compile error, and a row copied from
 * its neighbour — which is how the three come to read alike — is what the
 * assertions below hold.
 */
const LABELS: Record<LgDocumentVisibility, string> = {
  private: 'Only you',
  unlisted: 'Anyone with the link',
  public: 'Everyone'
};

describe('VisibilityTag', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    configureTestBed();
  });

  async function render(
    visibility: LgDocumentVisibility
  ): Promise<ComponentFixture<VisibilityTag>> {
    await TestBed.inject(TranslationService).setActiveLang('en');
    const fixture = TestBed.createComponent(VisibilityTag);
    fixture.componentRef.setInput('visibility', visibility);
    fixture.detectChanges();
    return fixture;
  }

  it.each(LG_DOCUMENT_VISIBILITIES)('names %s', async (visibility) => {
    const fixture = await render(visibility);

    // The chip is read by whoever was handed the link as much as by the
    // owner, so the words are the shared ones the picker draws — and the
    // same table the editor's dialog will be checked against.
    expect(fixture.nativeElement.textContent?.trim()).toBe(LABELS[visibility]);
  });

  it('tints the three states apart from one another', async () => {
    // One table for every surface that draws a state: the same word in one
    // colour on a shelf and another on the page would read as two states.
    // Asserted as distinctness rather than as class names, which are the
    // theme's business.
    const tints = await Promise.all(
      LG_DOCUMENT_VISIBILITIES.map(async (visibility) =>
        (await render(visibility)).nativeElement
          .querySelector('span')
          ?.className.trim()
      )
    );

    expect(new Set(tints).size).toBe(LG_DOCUMENT_VISIBILITIES.length);
  });
});
