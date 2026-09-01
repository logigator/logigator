import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ComponentFixture } from '@angular/core/testing';
import { AVAILABLE_LANGUAGES } from '@logigator/core';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { Router } from '@angular/router';
import { PreferencesService } from '../../storage/preferences.service';
import { TranslationService } from '../../translation/translation.service';
import { UserMenu } from './user-menu';

function overlay(selector: string): HTMLElement[] {
  return [
    ...document.querySelectorAll<HTMLElement>(
      `.cdk-overlay-container ${selector}`
    )
  ];
}

/**
 * Opens the account panel, then the language select inside it. Awaited because
 * `ngModel` writes the control's value a microtask after the binding runs, and
 * the selected option is what these assert on.
 */
async function openLanguages(): Promise<ComponentFixture<UserMenu>> {
  const f = TestBed.createComponent(UserMenu);
  f.detectChanges();
  (f.nativeElement.querySelector('button') as HTMLButtonElement).click();
  f.detectChanges();
  overlay('lg-select [role=combobox]')[0].click();
  await f.whenStable();
  return f;
}

describe('UserMenu', () => {
  beforeEach(() => {
    configureTestBed();
  });

  afterEach(() => {
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((el) => el.remove());
    document.cookie = 'preferences=; max-age=0; path=/';
    TestBed.resetTestingModule();
  });

  it('offers every language, marking the one the document is rendered in', async () => {
    await openLanguages();

    const options = overlay('[role=option]');
    expect(options.map((option) => option.textContent?.trim())).toEqual(
      AVAILABLE_LANGUAGES.map((language) => language.label)
    );
    expect(
      options
        .filter((option) => option.getAttribute('aria-selected') === 'true')
        .map((option) => option.textContent?.trim())
    ).toEqual(['English']);
  });

  it('switches the document to the chosen language, on the page it is on', async () => {
    // The language is a segment of every URL, so the switch is the table and
    // the prefix together; the shared cookie is what carries the choice to the
    // editor and to the language the API writes mails in.
    const f = await openLanguages();

    overlay('[role=option]')
      .find((option) => option.textContent?.trim() === 'Deutsch')
      ?.click();
    f.detectChanges();

    expect(TestBed.inject(PreferencesService).get('lang')).toBe('de');
    await vi.waitFor(() => {
      expect(TestBed.inject(TranslationService).getActiveLang()).toBe('de');
      expect(TestBed.inject(Router).url).toBe('/de');
    });
  });
});
