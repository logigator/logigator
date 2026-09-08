import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute } from '@angular/router';
import { convertToParamMap } from '@angular/router';
import { configureTestBed } from '../../../../testing/configure-test-bed';
import { VerifyEmailPage } from './verify-email-page';

const TOKEN = 'a-one-shot-token';

/**
 * The flag `@angular/build` defines for the server bundle and `afterNextRender`
 * reads to decide whether it may run at all — the real lever, rather than
 * `PLATFORM_ID`, which does not gate it.
 */
declare global {
  var ngServerMode: boolean | undefined;
}

function routeWithToken() {
  return {
    provide: ActivatedRoute,
    useValue: { snapshot: { paramMap: convertToParamMap({ token: TOKEN }) } }
  };
}

describe('VerifyEmailPage', () => {
  let http: HttpTestingController;

  function render() {
    configureTestBed([routeWithToken()], [VerifyEmailPage]);
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(VerifyEmailPage);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => TestBed.resetTestingModule());
  afterEach(() => {
    globalThis.ngServerMode = undefined;
  });

  it('redeems the token once the browser has the page', async () => {
    const fixture = render();
    await fixture.whenStable();

    const request = http.expectOne('/api/auth/verify-email');
    expect(request.request.body).toEqual({ token: TOKEN });
    request.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('spends nothing during a server render', async () => {
    globalThis.ngServerMode = true;
    const fixture = render();
    await fixture.whenStable();

    // A one-shot token that a render redeemed would be gone before the
    // recipient clicked: every crawler and link-previewing mail client fetches
    // this URL first.
    http.expectNone('/api/auth/verify-email');
  });
});
