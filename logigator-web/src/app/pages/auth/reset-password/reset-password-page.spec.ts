import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { configureTestBed } from '../../../../testing/configure-test-bed';
import { ResetPasswordPage } from './reset-password-page';

const TOKEN = 'a-reset-token';
const NEW_PASSWORD = 'correct1horse';

function routeWithQuery(query: Record<string, string>) {
  return {
    provide: ActivatedRoute,
    useValue: { queryParamMap: of(convertToParamMap(query)) }
  };
}

describe('ResetPasswordPage', () => {
  let http: HttpTestingController;
  let root: HTMLElement;
  let settle: () => Promise<void>;

  function render(query: Record<string, string> = {}): void {
    configureTestBed([routeWithQuery(query)], [ResetPasswordPage]);
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ResetPasswordPage);
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

  function submit(): void {
    root.querySelector('form')!.dispatchEvent(new Event('submit'));
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('asks for an address when the URL carries no token', () => {
    render();
    expect(root.querySelector('#reset-email')).not.toBeNull();
    expect(root.querySelector('#reset-password')).toBeNull();
  });

  it('takes the new password when the URL carries one', () => {
    render({ token: TOKEN });
    expect(root.querySelector('#reset-password')).not.toBeNull();
    expect(root.querySelector('#reset-email')).toBeNull();
  });

  it('confirms a requested link without saying whether the address exists', async () => {
    render();
    type('reset-email', 'nobody@example.com');
    submit();
    await settle();

    http
      .expectOne('/api/auth/password-reset')
      .flush(null, { status: 204, statusText: 'No Content' });
    await settle();

    // Only the neutral confirmation is left; a form that reported "no such
    // account" would be a way to test which addresses are registered, which is
    // why the API answers the same either way.
    expect(root.querySelector('form')).toBeNull();
    expect(root.querySelector('lg-message')).toBeNull();
  });

  it('spends the token from the URL rather than one the form carries', async () => {
    render({ token: TOKEN });
    type('reset-password', NEW_PASSWORD);
    type('reset-password-repeat', NEW_PASSWORD);
    submit();
    await settle();

    const request = http.expectOne('/api/auth/password-reset/confirm');
    expect(request.request.body).toEqual({
      token: TOKEN,
      password: NEW_PASSWORD
    });
  });

  it('does not resubmit a link the server has already refused', async () => {
    render({ token: TOKEN });
    type('reset-password', NEW_PASSWORD);
    type('reset-password-repeat', NEW_PASSWORD);
    submit();
    await settle();

    http
      .expectOne('/api/auth/password-reset/confirm')
      .flush(
        { code: 'token_invalid', message: 'gone' },
        { status: 400, statusText: 'Bad Request' }
      );
    await settle();

    expect(root.querySelector('button[type="submit"]')).toBeNull();
  });
});
