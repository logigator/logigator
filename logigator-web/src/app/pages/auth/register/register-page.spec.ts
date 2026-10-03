import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { configureTestBed } from '../../../../testing/configure-test-bed';
import { RegisterPage } from './register-page';

const PASSWORD = 'correct1horse';

describe('RegisterPage', () => {
  let http: HttpTestingController;
  let root: HTMLElement;
  let settle: () => Promise<void>;

  function render(): void {
    configureTestBed(
      [
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: of(convertToParamMap({})) }
        }
      ],
      [RegisterPage]
    );
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(RegisterPage);
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

  function fillValidForm(): void {
    type('register-username', 'ada');
    type('register-email', ' Ada@Example.com ');
    type('register-password', PASSWORD);
    type('register-password-repeat', PASSWORD);
  }

  function submit(): void {
    root.querySelector('form')!.dispatchEvent(new Event('submit'));
  }

  /** The message the field is currently showing, if any. */
  function messageFor(id: string): string | null {
    return root.querySelector(`#${id}-message`)?.textContent?.trim() ?? null;
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('sends the address the contract normalized, not the one typed', async () => {
    render();
    fillValidForm();
    submit();
    await settle();

    // `emailSchema` trims and lower-cases; parsing to build the body is what
    // makes the client send what the server would have stored anyway.
    expect(http.expectOne('/api/auth/register').request.body).toEqual({
      username: 'ada',
      email: 'ada@example.com',
      password: PASSWORD
    });
  });

  it('refuses to submit two passwords that do not match', async () => {
    render();
    fillValidForm();
    type('register-password-repeat', `${PASSWORD}x`);
    submit();
    await settle();

    http.expectNone('/api/auth/register');
    expect(messageFor('register-password-repeat')).not.toBeNull();
  });

  it('puts a taken address on the address field', async () => {
    render();
    fillValidForm();
    submit();
    await settle();

    http
      .expectOne('/api/auth/register')
      .flush(
        { code: 'conflict', message: 'taken' },
        { status: 409, statusText: 'Conflict' }
      );
    await settle();

    expect(messageFor('register-email')).not.toBeNull();
  });

  it('clears the taken-address message as soon as the address changes', async () => {
    render();
    fillValidForm();
    submit();
    await settle();
    http
      .expectOne('/api/auth/register')
      .flush(
        { code: 'conflict', message: 'taken' },
        { status: 409, statusText: 'Conflict' }
      );
    await settle();

    type('register-email', 'free@example.com');
    await settle();
    expect(messageFor('register-email')).toBeNull();
  });

  it('ends on the inbox rather than on a session', async () => {
    render();
    fillValidForm();
    submit();
    await settle();

    http
      .expectOne('/api/auth/register')
      .flush(
        { verificationRequired: true },
        { status: 201, statusText: 'Created' }
      );
    await settle();

    // Signing in stays refused until the mailed link is opened, so there is no
    // form left to submit.
    expect(root.querySelector('form')).toBeNull();
  });
});
