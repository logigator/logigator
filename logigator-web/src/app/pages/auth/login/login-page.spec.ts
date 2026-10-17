import { beforeEach, describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { configureTestBed } from '../../../../testing/configure-test-bed';
import { LoginPage } from './login-page';

const EMAIL = 'ada@example.com';
const PASSWORD = 'secret';

function routeWithQuery(query: Record<string, string>) {
  return {
    provide: ActivatedRoute,
    useValue: { queryParamMap: of(convertToParamMap(query)) }
  };
}

/**
 * Assertions go through the DOM structure — how many messages, whether the
 * resend offer is there — rather than through message text, which is a
 * translation and belongs to the locale files.
 */
class Page {
  constructor(private readonly fixture: ComponentFixture<LoginPage>) {}

  private get root(): HTMLElement {
    return this.fixture.nativeElement as HTMLElement;
  }

  get messageCount(): number {
    return this.root.querySelectorAll('lg-message').length;
  }

  /** The resend button, offered only for an account with an unconfirmed address. */
  get resendOffer(): HTMLButtonElement | null {
    return this.root.querySelector('form button[type="button"]');
  }

  async signIn(): Promise<void> {
    for (const [id, value] of [
      ['login-email', EMAIL],
      ['login-password', PASSWORD]
    ]) {
      const input = this.root.querySelector(`#${id}`) as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    }
    this.root.querySelector('form')!.dispatchEvent(new Event('submit'));
    await this.settle();
  }

  async settle(): Promise<void> {
    await this.fixture.whenStable();
    this.fixture.detectChanges();
  }
}

describe('LoginPage', () => {
  let http: HttpTestingController;
  let page: Page;

  function render(query: Record<string, string> = {}): void {
    configureTestBed([routeWithQuery(query)], [LoginPage]);
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
    page = new Page(fixture);
  }

  function failLogin(status: number, code: string): void {
    http
      .expectOne('/api/auth/login')
      .flush({ code, message: code }, { status, statusText: code });
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('offers the confirmation mail again when the address is unconfirmed', async () => {
    render();
    await page.signIn();
    failLogin(403, 'email_not_verified');
    await page.settle();

    expect(page.resendOffer).not.toBeNull();
  });

  it('sends the confirmation mail with the credentials already typed', async () => {
    render();
    await page.signIn();
    failLogin(403, 'email_not_verified');
    await page.settle();

    page.resendOffer!.click();
    await page.settle();

    const resend = http.expectOne('/api/auth/resend-verification');
    expect(resend.request.body).toEqual({ email: EMAIL, password: PASSWORD });
  });

  it('keeps a wrong password off the resend path', async () => {
    render();
    await page.signIn();
    failLogin(401, 'invalid_credentials');
    await page.settle();

    // Resending would mail an address whose password the caller got wrong.
    expect(page.resendOffer).toBeNull();
    expect(page.messageCount).toBe(1);
  });

  it('reports the reason a Google round trip came back with', async () => {
    render({ error: 'google_email_taken' });
    await page.settle();
    expect(page.messageCount).toBe(1);
  });

  it('opens with nothing to report', async () => {
    render();
    await page.settle();
    expect(page.messageCount).toBe(0);
  });
});
