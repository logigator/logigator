import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { Type } from '@angular/core';
import { HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of } from 'rxjs';
import { ConfirmationService } from '@logigator/ui';
import type { UserResponse } from '@logigator/contract';
import { configureTestBed } from '../../../../testing/configure-test-bed';
import { AuthProvidersService } from '../../../user/auth-providers.service';
import { SessionService } from '../../../user/session.service';
import { AccountDeleteSection } from './account-delete-section';
import { AccountEmailSection } from './account-email-section';
import { AccountGoogleSection } from './account-google-section';
import { AccountPasswordSection } from './account-password-section';
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
  profileVersion: 1,
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
   * nothing would test nothing. `resolve` is what reads the API, and is
   * stubbed: the app initializer's call would otherwise replace the account
   * with the anonymous answer a missing hint cookie gets.
   */
  function render<T>(
    component: Type<T>,
    user: UserResponse = USER,
    beforeCreate?: () => void
  ): void {
    configureTestBed(
      [{ provide: SessionService, useClass: SessionService }],
      [component]
    );
    vi.spyOn(SessionService.prototype, 'resolve').mockResolvedValue();
    beforeCreate?.();
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

  /** The page as a Google round trip, or the API refusing one, leaves it. */
  function arrivingWith(query: Record<string, string>): () => void {
    return () => {
      const params = convertToParamMap(query);
      TestBed.overrideProvider(ActivatedRoute, {
        useValue: {
          snapshot: { queryParamMap: params },
          queryParamMap: of(params)
        }
      });
      vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    };
  }

  function refuseForAge(): void {
    http
      .expectOne('/api/user')
      .flush(
        { code: 'reauthentication_required', message: 'Sign in again.' },
        { status: 403, statusText: 'Forbidden' }
      );
  }

  /** Where the prompt's link sends the browser back to, as a parsed URL. */
  function returnPathOf(link: HTMLAnchorElement) {
    const start = new URL(link.href, 'http://localhost');
    expect(start.pathname).toBe('/api/auth/google');
    return TestBed.inject(Router).parseUrl(
      start.searchParams.get('returnUrl')!
    );
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    sessionStorage.clear();
  });

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
    // the untouched fields send back, against the version they were drawn from.
    expect(request.request.body).toEqual({
      username: 'ada_l',
      bio: '',
      websiteUrl: null,
      socialLinks: [],
      profileVersion: 1
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
    expect(request.request.body).toMatchObject({
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

  it('saves a website field holding only spaces as no website', async () => {
    render(AccountProfileSection, {
      ...USER,
      websiteUrl: 'https://ada.example/'
    });
    type('account-website', '   ');
    root.querySelector('form')!.dispatchEvent(new Event('submit'));
    await settle();

    expect(http.expectOne('/api/user').request.body).toMatchObject({
      websiteUrl: null
    });
  });

  /**
   * Another tab saved the profile since these fields were drawn. The refusal
   * leaves what was typed in place, and only the member's own request replaces
   * it with the saved profile, whose version the next save then presents.
   */
  it('keeps the typed profile through a stale save and loads the saved one on request', async () => {
    render(AccountProfileSection);
    type('account-bio', 'Typed in this tab.');
    root.querySelector('form')!.dispatchEvent(new Event('submit'));
    await settle();

    http
      .expectOne('/api/user')
      .flush(
        { code: 'version_conflict', message: 'Changed elsewhere.' },
        { status: 409, statusText: 'Conflict' }
      );
    await settle();

    const bio = root.querySelector('#account-bio') as HTMLTextAreaElement;
    expect(bio.value).toBe('Typed in this tab.');

    (root.querySelector('form button[type="button"]') as HTMLElement).click();
    await settle();
    const read = http.expectOne('/api/user');
    expect(read.request.method).toBe('GET');
    read.flush({ ...USER, bio: 'Saved in another tab.', profileVersion: 2 });
    await settle();

    expect(bio.value).toBe('Saved in another tab.');
    expect(session.user()?.profileVersion).toBe(2);

    root.querySelector('form')!.dispatchEvent(new Event('submit'));
    await settle();
    expect(http.expectOne('/api/user').request.body).toMatchObject({
      bio: 'Saved in another tab.',
      profileVersion: 2
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

  describe('for an account without a password', () => {
    const GOOGLE_ONLY: UserResponse = {
      ...USER,
      hasPassword: false,
      googleLinked: true
    };

    function acceptConfirmations(): void {
      TestBed.inject(ConfirmationService).requireConfirmation$.subscribe(
        (request) => request.accept?.()
      );
    }

    it('sends a stale session through Google and back to this page to resume', async () => {
      render(AccountDeleteSection, GOOGLE_ONLY);
      acceptConfirmations();

      root.querySelector('button')!.click();
      await settle();
      refuseForAge();
      await settle();

      const link = root.querySelector('a[href]') as HTMLAnchorElement;
      expect(returnPathOf(link).queryParams).toEqual({ resume: 'delete' });
      // Deleting again would only be refused again.
      expect(root.querySelector('button')).toBeNull();
    });

    it('opens the confirmation on returning from Google, and deletes on accept', async () => {
      let navigate!: ReturnType<typeof vi.spyOn>;
      render(AccountDeleteSection, GOOGLE_ONLY, () => {
        TestBed.overrideProvider(ActivatedRoute, {
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({ resume: 'delete' })
            }
          }
        });
        const router = TestBed.inject(Router);
        navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
        vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
        acceptConfirmations();
      });
      await settle();

      expect(navigate).toHaveBeenCalledWith(
        [],
        expect.objectContaining({
          queryParams: { resume: null, error: null },
          replaceUrl: true
        })
      );
      const request = http.expectOne('/api/user');
      expect(request.request.method).toBe('DELETE');
      expect(request.request.body).toEqual({});
    });

    it('keeps the typed address through the round trip and sends it on return', async () => {
      render(AccountEmailSection, GOOGLE_ONLY);
      type('account-email', 'ada@elsewhere.example');
      root.querySelector('form')!.dispatchEvent(new Event('submit'));
      await settle();
      refuseForAge();
      await settle();

      const link = root.querySelector('a[href]') as HTMLAnchorElement;
      expect(returnPathOf(link).queryParams).toEqual({ resume: 'email' });
      // The browser would leave here; the draft is kept as it does.
      link.addEventListener('click', (event) => event.preventDefault());
      link.click();

      TestBed.resetTestingModule();
      render(
        AccountEmailSection,
        GOOGLE_ONLY,
        arrivingWith({ resume: 'email' })
      );
      await settle();

      const request = http.expectOne('/api/user');
      expect(request.request.method).toBe('PATCH');
      expect(request.request.body).toEqual({ email: 'ada@elsewhere.example' });
    });

    it('never carries a new password across the round trip', async () => {
      render(AccountPasswordSection, GOOGLE_ONLY);
      type('account-new-password', 'turing1936');
      type('account-new-password-repeat', 'turing1936');
      root.querySelector('form')!.dispatchEvent(new Event('submit'));
      await settle();
      refuseForAge();
      await settle();

      const link = root.querySelector('a[href]') as HTMLAnchorElement;
      expect(returnPathOf(link).queryParams).toEqual({ resume: 'password' });
      link.addEventListener('click', (event) => event.preventDefault());
      link.click();
      expect(sessionStorage.length).toBe(0);

      TestBed.resetTestingModule();
      render(
        AccountPasswordSection,
        GOOGLE_ONLY,
        arrivingWith({ resume: 'password' })
      );
      await settle();

      // Nothing to send: the member types it again, starting in the field.
      expect(http.match(() => true)).toHaveLength(0);
      expect(document.activeElement?.id).toBe('account-new-password');
    });
  });

  describe('the Google section', () => {
    function withGoogle(query: Record<string, string> = {}): () => void {
      return () => {
        TestBed.overrideProvider(AuthProvidersService, {
          useValue: { googleAvailable: () => true }
        });
        arrivingWith(query)();
        TestBed.inject(ConfirmationService).requireConfirmation$.subscribe(
          (request) => request.accept?.()
        );
      };
    }

    /**
     * The API starts a link only from a recent sign-in and sends an older
     * session back. Signing in again with the password, as the account's own
     * address, is what makes the session recent before going on to Google.
     */
    it('signs in again as this account when a link was refused for the session age', async () => {
      render(
        AccountGoogleSection,
        USER,
        withGoogle({ error: 'google_reauthentication_required' })
      );
      await settle();

      type('account-google-password', 'lovelace1');
      root.querySelector('button')!.click();
      await settle();

      const request = http.expectOne('/api/auth/login');
      expect(request.request.body).toEqual({
        email: 'ada@example.com',
        password: 'lovelace1'
      });
    });

    it('unlinks with the password', async () => {
      render(
        AccountGoogleSection,
        { ...USER, googleLinked: true },
        withGoogle()
      );
      await settle();

      type('account-google-password', 'lovelace1');
      root.querySelector('button')!.click();
      await settle();

      const request = http.expectOne('/api/auth/google');
      expect(request.request.method).toBe('DELETE');
      expect(request.request.body).toEqual({ password: 'lovelace1' });
      request.flush({ ...USER, googleLinked: false });
      await settle();

      expect(session.user()?.googleLinked).toBe(false);
    });
  });
});
