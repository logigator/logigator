import { beforeEach, describe, expect, it } from 'vitest';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import {
  Translation,
  TRANSLOCO_LOADER,
  TranslocoLoader,
  TranslocoService
} from '@jsverse/transloco';

import { TranslateDirective } from './translate.directive';
import { configureTestBed } from '../../testing/configure-test-bed';

/** Distinct values per language, plus a key carrying interpolation params. */
class TwoLangLoader implements TranslocoLoader {
  getTranslation(lang: string): Promise<Translation> {
    const tables: Record<string, Translation> = {
      en: {
        common: {
          save: 'Save',
          moved: 'Moved to position {{position}} of {{total}}'
        }
      },
      de: { common: { save: 'Speichern' } }
    };
    return Promise.resolve(tables[lang] ?? {});
  }
}

@Component({
  imports: [TranslateDirective],
  template: `<span *appTranslate="let t" id="host">{{
    t('common.save')
  }}</span>`
})
class SaveLabelHostComponent {}

@Component({
  imports: [TranslateDirective],
  template: `<span *appTranslate="let t">{{
    t('common.moved', { position: 2, total: 5 })
  }}</span>`
})
class ParamHostComponent {}

describe('TranslateDirective', () => {
  beforeEach(async () => {
    configureTestBed([{ provide: TRANSLOCO_LOADER, useClass: TwoLangLoader }]);
    const transloco = TestBed.inject(TranslocoService);
    await firstValueFrom(transloco.load('en'));
    transloco.setActiveLang('en');
  });

  it('re-translates in place when the active language changes', async () => {
    const fixture = TestBed.createComponent(SaveLabelHostComponent);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement.querySelector('#host');
    expect(element.textContent).toBe('Save');

    const transloco = TestBed.inject(TranslocoService);
    transloco.setActiveLang('de');
    await firstValueFrom(transloco.load('de'));
    // No forced detectChanges: the text only changes if the post-load signal read
    // inside `t()` marked this view dirty, which is what makes the directive work
    // under zoneless change detection.
    await fixture.whenStable();

    expect(element.textContent).toBe('Speichern');
    // The same element survives — bindings update rather than the view being
    // destroyed and recreated, so state inside the block (focus, scroll, child
    // components) outlives a language switch.
    expect(fixture.nativeElement.querySelector('#host')).toBe(element);
  });

  it('forwards interpolation params', async () => {
    const fixture = TestBed.createComponent(ParamHostComponent);
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain(
      'Moved to position 2 of 5'
    );
  });
});
