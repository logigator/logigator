import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { throwError, of } from 'rxjs';
import { ApiRequestError } from '../api/api-error';
import { UserService } from './user.service';
import { UserApiService } from '../api/services/user-api.service';
import { CookieService } from '../storage/cookie.service';
import { ToastService } from '../logging/toast.service';
import { makeUser } from '../../testing/user-fixtures';
import { configureTestBed } from '../../testing/configure-test-bed';

const USER = makeUser('user-1');

describe('UserService', () => {
  let authCookie: ReturnType<typeof signal<string | null>>;
  let cookieDelete: Mock;
  let userApi: { get: Mock; logout: Mock };
  let toast: { error: Mock; warn: Mock; success: Mock };

  beforeEach(() => {
    authCookie = signal<string | null>(null);
    cookieDelete = vi.fn((name: string) => {
      if (name === 'isAuthenticated') authCookie.set(null);
    });
    userApi = {
      get: vi.fn().mockReturnValue(of(USER)),
      logout: vi.fn().mockReturnValue(of(undefined))
    };
    toast = { error: vi.fn(), warn: vi.fn(), success: vi.fn() };

    configureTestBed([
      {
        provide: CookieService,
        useValue: {
          get: (name: string) =>
            name === 'isAuthenticated' ? authCookie() : null,
          delete: cookieDelete
        }
      },
      { provide: UserApiService, useValue: userApi },
      { provide: ToastService, useValue: toast }
    ]);
  });

  function start(): UserService {
    const service = TestBed.inject(UserService);
    TestBed.tick();
    return service;
  }

  it('loads the user when the auth cookie flips true, clears it on false', () => {
    const service = start();
    expect(service.user()).toBeNull();

    authCookie.set('true');
    TestBed.tick();
    expect(userApi.get).toHaveBeenCalled();
    expect(service.user()).toEqual(USER);

    authCookie.set(null);
    TestBed.tick();
    expect(service.user()).toBeNull();
  });

  it('treats a 401 on user load as an expired session: cookie cleaned, no error toast', () => {
    userApi.get.mockReturnValue(
      throwError(() => new ApiRequestError(401, 'unauthorized', 'No session'))
    );
    const service = start();
    authCookie.set('true');
    TestBed.tick();

    expect(service.user()).toBeNull();
    expect(cookieDelete).toHaveBeenCalledWith('isAuthenticated');
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('keeps the cookie on other load failures (the session may still be valid)', () => {
    userApi.get.mockReturnValue(
      throwError(() => new ApiRequestError(500, 'internal', 'Server error'))
    );
    const service = start();
    authCookie.set('true');
    TestBed.tick();

    expect(service.user()).toBeNull();
    expect(cookieDelete).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it('sessionExpired clears the user and the stale auth cookie', () => {
    const service = start();
    authCookie.set('true');
    TestBed.tick();
    expect(service.user()).toEqual(USER);

    service.sessionExpired();
    TestBed.tick();

    expect(service.user()).toBeNull();
    expect(cookieDelete).toHaveBeenCalledWith('isAuthenticated');
  });

  it('logout is throwing transport with no toasts of its own', async () => {
    const service = start();
    await service.logout();
    expect(userApi.logout).toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();

    userApi.logout.mockReturnValue(throwError(() => new Error('offline')));
    await expect(service.logout()).rejects.toThrow('offline');
    expect(toast.error).not.toHaveBeenCalled();
  });
});
