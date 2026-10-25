import { afterEach, describe, expect, it } from 'vitest';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { DialogService } from '../dynamic-dialog/dialog.service';
import { LgConsentBanner } from './consent-banner';
import { LgConsentCopy } from './consent-copy';
import { LgConsentPreferences } from './consent-preferences';

const COPY: LgConsentCopy = {
  title: 'Cookies',
  text: 'We ask first.',
  privacyLabel: 'Privacy policy',
  privacyHref: '/privacy-policy',
  acceptAll: 'Accept all',
  rejectAll: 'Reject all',
  customize: 'Customize',
  preferencesTitle: 'Cookie settings',
  preferencesText: 'Choose.',
  save: 'Save choices',
  categories: [
    { id: 'necessary', title: 'Necessary', description: 'On.', required: true },
    { id: 'analytics', title: 'Analytics', description: 'Counts.' },
    { id: 'media', title: 'Media', description: 'Videos.' }
  ]
};

function setupBanner() {
  const fixture = TestBed.createComponent(LgConsentBanner);
  fixture.componentRef.setInput('copy', COPY);
  fixture.detectChanges();
  const decisions: (readonly string[])[] = [];
  fixture.componentInstance.decide.subscribe((granted) =>
    decisions.push(granted)
  );
  const button = (label: string): HTMLButtonElement =>
    Array.from<HTMLButtonElement>(
      fixture.nativeElement.querySelectorAll('button')
    ).find((b) => b.textContent?.trim() === label)!;
  return { fixture, decisions, button };
}

describe('LgConsentBanner', () => {
  it('grants every optional category on accept, and no required one', () => {
    const { decisions, button } = setupBanner();

    button('Accept all').click();

    expect(decisions).toEqual([['analytics', 'media']]);
  });

  it('grants nothing on reject', () => {
    const { decisions, button } = setupBanner();

    button('Reject all').click();

    expect(decisions).toEqual([[]]);
  });

  it('asks for the preferences without deciding anything', () => {
    const { fixture, decisions, button } = setupBanner();
    let asked = 0;
    fixture.componentInstance.customize.subscribe(() => asked++);

    button('Customize').click();

    expect(asked).toBe(1);
    expect(decisions).toEqual([]);
  });

  it('is a landmark named by its own title', () => {
    const { fixture } = setupBanner();
    const host: HTMLElement = fixture.nativeElement;
    const title = host.querySelector(
      `#${host.getAttribute('aria-labelledby')}`
    );

    expect(host.getAttribute('role')).toBe('region');
    expect(title?.textContent?.trim()).toBe('Cookies');
  });
});

async function open(granted: readonly string[]) {
  const ref = TestBed.inject(DialogService).open(LgConsentPreferences, {
    header: COPY.preferencesTitle,
    data: { copy: COPY, granted }
  });
  const result = firstValueFrom(ref.onClose);
  const appRef = TestBed.inject(ApplicationRef);
  appRef.tick();
  await appRef.whenStable();
  appRef.tick();
  const root = document.querySelector('lg-consent-preferences')!;
  const toggle = (id: string): HTMLInputElement =>
    root.querySelector(`input[role=switch][id$="-${id}"]`)!;
  const button = (label: string): HTMLButtonElement =>
    Array.from(root.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === label
    )!;
  return { result, toggle, button, appRef };
}

describe('LgConsentPreferences', () => {
  afterEach(() => {
    document.querySelector('.cdk-overlay-container')?.remove();
  });

  it('opens on the categories already granted', async () => {
    const { toggle } = await open(['media']);

    expect(toggle('analytics').checked).toBe(false);
    expect(toggle('media').checked).toBe(true);
  });

  it('shows a required category as on and unchangeable', async () => {
    const { toggle } = await open([]);

    expect(toggle('necessary').checked).toBe(true);
    expect(toggle('necessary').disabled).toBe(true);
  });

  it('saves what was switched, in the order the copy lists it', async () => {
    const { result, toggle, button, appRef } = await open([]);

    for (const id of ['media', 'analytics']) {
      toggle(id).checked = true;
      toggle(id).dispatchEvent(new Event('change'));
    }
    appRef.tick();
    button('Save choices').click();

    expect(await result).toEqual(['analytics', 'media']);
  });

  it('answers accept and reject whatever the switches say', async () => {
    const accepted = await open([]);
    accepted.button('Accept all').click();
    expect(await accepted.result).toEqual(['analytics', 'media']);

    const rejected = await open(['analytics', 'media']);
    rejected.button('Reject all').click();
    expect(await rejected.result).toEqual([]);
  });

  it('drops a granted name the copy does not list', async () => {
    // A category the question no longer asks about is not carried over.
    const { result, button } = await open(['analytics', 'retired']);

    button('Save choices').click();

    expect(await result).toEqual(['analytics']);
  });
});
