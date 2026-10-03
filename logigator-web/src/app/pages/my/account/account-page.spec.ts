import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { Type } from '@angular/core';
import { HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { ConfirmationService } from '@logigator/ui';
import type { UserResponse } from '@logigator/contract';
import { configureTestBed } from '../../../../testing/configure-test-bed';
import { SessionService } from '../../../user/session.service';
import { AccountDeleteSection } from './account-delete-section';
import { AccountProfileSection } from './account-profile-section';

const USER: UserResponse = {
  id: '00000000-0000-4000-8000-000000000000',
  username: 'ada',
  email: 'ada@example.com',
  emailVerified: true,
  avatar: null,
  bio: '',
  websiteUrl: null,
  socialLinks: [],
  memberSince: '2026-01-01T00:00:00.000Z',
  hasPassword: true,
  googleLinked: false
};

describe('the account sections', () => {
  let http: HttpTestingController;
  let session: SessionService;
  let root: HTMLElement;
  let settle: () => Promise<void>;

  /**
   * The real `SessionService`, reinstated over the anonymous stub: these
   * sections are about what a write puts back into it, and a stub that records
   * nothing would test nothing. It costs no request — `resolve` is what reads
   * the API, and nothing calls it here.
   */
  function render<T>(component: Type<T>, user: UserResponse = USER): void {
    configureTestBed(
      [{ provide: SessionService, useClass: SessionService }],
      [component]
    );
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionService);
    session.signedIn(user);

    const fixture: ComponentFixture<T> = TestBed.createComponent(component);
    fixture.detectChanges();
    root = fixture.nativeElement as HTMLElement;
    settle = async () => {
      await fixture.whenStable();
      fixture.detectChanges();
    };
  }

  function type(id: string, value: string): void {
    const input = root.querySelector(`#${id}`) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  beforeEach(() => TestBed.resetTestingModule());

  /**
   * The bar above reads the account out of `SessionService`, so a rename that
   * only reached the API would leave the old name on screen until the next
   * page load.
   */
  it('puts a renamed account back into the session', async () => {
    render(AccountProfileSection);
    type('account-username', 'ada_l');
    root.querySelector('form')!.dispatchEvent(new Event('submit'));
    await settle();

    const request = http.expectOne('/api/user');
    expect(request.request.method).toBe('PATCH');
    // The section's fields, written together: every one is on screen and one
    // Save is what the form offers. The account's own empty profile is what
    // the untouched fields send back.
    expect(request.request.body).toEqual({
      username: 'ada_l',
      bio: '',
      websiteUrl: null,
      socialLinks: []
    });
    request.flush({
      user: { ...USER, username: 'ada_l' },
      emailVerificationSent: false
    });
    await settle();

    expect(session.user()?.username).toBe('ada_l');
  });

  /**
   * The body is the request schema's own output, so this is the write path
   * carrying the normalization rather than a second copy of it: what leaves the
   * form is what a later read answers with, tracking parameters and all.
   */
  it('submits the profile links in the form the API stores them', async () => {
    render(AccountProfileSection);
    type('account-bio', '  Relays and old microprocessors.  ');
    type('account-website', 'https://Ada.Example/blog?utm_source=mail&page=2');
    type('account-link0', 'https://GitHub.com/ada?utm_campaign=profile');
    root.querySelector('form')!.dispatchEvent(new Event('submit'));
    await settle();

    const request = http.expectOne('/api/user');
    expect(request.request.body).toEqual({
      username: 'ada',
      bio: 'Relays and old microprocessors.',
      websiteUrl: 'https://ada.example/blog?page=2',
      // Two blank slots are no slots, so the list is the link alone.
      socialLinks: ['https://github.com/ada']
    });
  });

  it('clears the website by emptying its field', async () => {
    render(AccountProfileSection, {
      ...USER,
      websiteUrl: 'https://ada.example/',
      socialLinks: [{ url: 'https://github.com/ada', platform: 'github' }]
    });
    type('account-website', '');
    root.querySelector('form')!.dispatchEvent(new Event('submit'));
    await settle();

    const request = http.expectOne('/api/user');
    // Null and not an empty string: the column tells "no website" from "an
    // empty one", and the profile page draws nothing for the first.
    expect(request.request.body).toMatchObject({
      websiteUrl: null,
      socialLinks: ['https://github.com/ada']
    });
  });

  it('refuses a link the API would refuse, without spending a request on it', async () => {
    render(AccountProfileSection);
    type('account-link0', 'javascript:alert(1)');
    root.querySelector('form')!.dispatchEvent(new Event('submit'));
    await settle();

    // The field's own schema is the contract's, so the shape the API would
    // answer 422 to never reaches it.
    expect(http.match(() => true)).toHaveLength(0);
  });

  /**
   * The session went with the account, so signing out is local: `logout()`
   * would spend a request on a session that no longer exists — and the API
   * answers 204 to one either way, which would hide the mistake.
   */
  it('forgets a deleted account locally rather than asking the API to sign out', async () => {
    render(AccountDeleteSection);
    const logout = vi.spyOn(session, 'logout');
    // The destination, not the navigation: `/en` resolves through the home
    // page's own guard, which has reads of its own that say nothing here.
    const home = vi
      .spyOn(TestBed.inject(Router), 'navigateByUrl')
      .mockResolvedValue(true);
    // The confirmation is the real service; accepting is what a click does.
    TestBed.inject(ConfirmationService).requireConfirmation$.subscribe(
      (request) => request.accept?.()
    );

    type('account-delete-password', 'lovelace1');
    root.querySelector('button')!.click();
    await settle();

    const request = http.expectOne('/api/user');
    expect(request.request.method).toBe('DELETE');
    expect(request.request.body).toEqual({ password: 'lovelace1' });
    request.flush(null, { status: 204, statusText: 'No Content' });
    await settle();

    expect(session.user()).toBeNull();
    expect(logout).not.toHaveBeenCalled();
    expect(home).toHaveBeenCalledWith('/en');
  });
});
