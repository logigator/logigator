import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { DialogService } from '@logigator/ui';
import { SessionLifecycleService } from './session-lifecycle.service';
import { UserService } from './user.service';
import { CookieService } from '../storage/cookie.service';
import { PersistenceService } from '../persistence/persistence.service';
import { CustomComponentService } from '../custom-component/custom-component.service';
import { UploadCoordinatorService } from '../ui/upload/upload-coordinator.service';
import { SimulationService } from '../simulation/simulation.service';
import { environment } from '../../environments/environment';
import { configureTestBed } from '../../testing/configure-test-bed';

/**
 * The real startup chain end-to-end: auth cookie → real `UserService` loads
 * `/api/user` → real `SessionLifecycleService` effect → cloud library preload.
 * The unit specs mock `UserService`; this one exists because the chain broke
 * once with every unit green (the pieces worked, their composition did not).
 */
describe('session startup (integration)', () => {
  let authCookie: ReturnType<typeof signal<string | null>>;
  let httpMock: HttpTestingController;
  let persistence: {
    preloadComponentIdAliases: Mock;
    preloadServerMasters: Mock;
    clearServerMasters: Mock;
    createAndSetEmptyProject: Mock;
    localDependenciesOfProject: Mock;
  };

  beforeEach(() => {
    authCookie = signal<string | null>(null);
    persistence = {
      preloadComponentIdAliases: vi.fn().mockResolvedValue(undefined),
      preloadServerMasters: vi.fn().mockResolvedValue(undefined),
      clearServerMasters: vi.fn(),
      createAndSetEmptyProject: vi.fn(),
      localDependenciesOfProject: vi.fn().mockReturnValue([])
    };
    configureTestBed([
      {
        provide: CookieService,
        useValue: {
          get: (name: string) =>
            name === 'isAuthenticated' ? authCookie() : null,
          delete: vi.fn()
        }
      },
      { provide: PersistenceService, useValue: persistence },
      {
        provide: CustomComponentService,
        useValue: { forceCloseComponent: vi.fn() }
      },
      {
        provide: UploadCoordinatorService,
        useValue: { promoteLocalDepsAndSave: vi.fn() }
      },
      { provide: SimulationService, useValue: { exit: vi.fn() } },
      { provide: DialogService, useValue: { open: vi.fn() } }
    ]);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('a session existing at startup loads the cloud library once the user resolves', async () => {
    // The auth cookie is already set when the app boots.
    authCookie.set('true');

    // AppComponent-equivalent bootstrap: instantiate the lifecycle (and with
    // it the real UserService, whose cookie effect fires the user load).
    TestBed.inject(SessionLifecycleService);
    TestBed.inject(UserService);
    TestBed.tick();

    const req = httpMock.expectOne(`${environment.apiUrl}/api/user`);
    req.flush({
      status: 200,
      data: {
        id: 'user-1',
        memberSince: '2024-01-01',
        username: 'andreas',
        image: null
      }
    });
    TestBed.tick();
    await new Promise((resolve) => setTimeout(resolve));

    expect(persistence.preloadServerMasters).toHaveBeenCalledTimes(1);
    expect(persistence.clearServerMasters).not.toHaveBeenCalled();
  });

  it('still loads the library when the backend omits the user id (pre-@Expose responses)', async () => {
    // The regression that motivated this file: /api/user serialized without
    // `id` (class-level @Exclude, no @Expose), so an id-keyed transition never
    // fired and the cloud library never loaded. Identity must fall back to the
    // unique account fields.
    authCookie.set('true');
    TestBed.inject(SessionLifecycleService);
    TestBed.inject(UserService);
    TestBed.tick();

    httpMock.expectOne(`${environment.apiUrl}/api/user`).flush({
      status: 200,
      data: {
        username: 'andreas',
        email: 'andreas@example.com',
        image: null,
        shortcuts: []
      }
    });
    TestBed.tick();
    await new Promise((resolve) => setTimeout(resolve));

    expect(persistence.preloadServerMasters).toHaveBeenCalledTimes(1);
  });

  it('logging in later (cookie flip) loads the cloud library', async () => {
    TestBed.inject(SessionLifecycleService);
    TestBed.inject(UserService);
    TestBed.tick();
    httpMock.expectNone(`${environment.apiUrl}/api/user`);

    authCookie.set('true');
    TestBed.tick();
    httpMock.expectOne(`${environment.apiUrl}/api/user`).flush({
      status: 200,
      data: {
        id: 'user-1',
        memberSince: '2024-01-01',
        username: 'andreas',
        image: null
      }
    });
    TestBed.tick();
    await new Promise((resolve) => setTimeout(resolve));

    expect(persistence.preloadServerMasters).toHaveBeenCalledTimes(1);
  });
});
