import { beforeEach, describe, expect, it } from 'vitest';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../testing/configure-test-bed';
import { TranslateDirective } from './translate.directive';
import { TranslationService } from './translation.service';

@Component({
  imports: [TranslateDirective],
  template: `<span *webTranslate="let t">{{ t('header.language') }}</span>`
})
class HostComponent {}

describe('TranslateDirective', () => {
  beforeEach(() => {
    configureTestBed([], [HostComponent]);
  });

  it('retranslates its content when the document switches language', async () => {
    // The document switches language in place, so `t` has to be a reactive read
    // rather than a lookup made once when the view was created.
    const translation = TestBed.inject(TranslationService);
    // The app initializer that loads the table resolves after this spec has
    // its component, so the starting language is set here.
    await translation.setActiveLang('en');

    const f = TestBed.createComponent(HostComponent);
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Language');

    await translation.setActiveLang('de');
    f.detectChanges();

    expect(f.nativeElement.textContent).toContain('Sprache');
  });
});
