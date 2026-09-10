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
  function render<T>(component: Type<T>): void {
    configureTestBed(
      [{ provide: SessionService, useClass: SessionService }],
      [component]
    );
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionService);
    session.signedIn(USER);

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
    expect(request.request.body).toEqual({ username: 'ada_l' });
    request.flush({
      user: { ...USER, username: 'ada_l' },
      emailVerificationSent: false
    });
    await settle();

    expect(session.user()?.username).toBe('ada_l');
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
