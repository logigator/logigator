import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { ConfirmationService, type Confirmation } from '@logigator/ui';
import { TranslationService } from '../translation/translation.service';
import { HoldsUnsavedChanges, unsavedChangesGuard } from './unsaved-changes';

@Component({ template: '' })
class EditingPage implements HoldsUnsavedChanges {
  public unsaved = false;
  public hasUnsavedChanges(): boolean {
    return this.unsaved;
  }
}

@Component({ template: '' })
class OtherPage {}

describe('unsavedChangesGuard', () => {
  let harness: RouterTestingHarness;
  let router: Router;
  let page: EditingPage;
  let asked: Confirmation[];

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        // Componentless like the app's own `:lang`, so its parameter is
        // inherited by the page the way a language switch sees it.
        provideRouter([
          {
            path: ':lang',
            children: [
              {
                path: 'account',
                component: EditingPage,
                canDeactivate: [unsavedChangesGuard]
              },
              { path: 'other', component: OtherPage }
            ]
          }
        ]),
        { provide: TranslationService, useValue: { translate: String } }
      ]
    });
    asked = [];
    TestBed.inject(ConfirmationService).requireConfirmation$.subscribe(
      (request) => asked.push(request)
    );
    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create();
    page = await harness.navigateByUrl('/en/account', EditingPage);
  });

  it('leaves a page with nothing unsaved without asking', async () => {
    expect(await router.navigateByUrl('/en/other')).toBe(true);
    expect(asked).toEqual([]);
  });

  it('asks before unsaved edits are left, and stays when declined', async () => {
    page.unsaved = true;

    const declined = router.navigateByUrl('/en/other');
    await vi.waitFor(() => expect(asked).toHaveLength(1));
    asked[0].reject!();
    expect(await declined).toBe(false);
    expect(router.url).toBe('/en/account');

    const accepted = router.navigateByUrl('/en/other');
    await vi.waitFor(() => expect(asked).toHaveLength(2));
    asked[1].accept!();
    expect(await accepted).toBe(true);
    expect(router.url).toBe('/en/other');
  });

  it('switches language without asking, since the page and its form stay', async () => {
    page.unsaved = true;

    expect(await router.navigateByUrl('/de/account')).toBe(true);
    expect(asked).toEqual([]);
    expect(harness.routeDebugElement?.componentInstance).toBe(page);
  });
});
