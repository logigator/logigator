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
import { ComponentLibraryService } from '../custom-component/component-library.service';
import { PromotionService } from '../persistence/promotion.service';
import { CustomComponentService } from '../custom-component/custom-component.service';
import { UploadCoordinatorService } from '../ui/upload/upload-coordinator.service';
import { SimulationService } from '../simulation/simulation.service';
import { environment } from '../../environments/environment';
import { configureTestBed } from '../../testing/configure-test-bed';
import { makeUser } from '../../testing/user-fixtures';

/** The signed-in account both flows resolve to. */
const USER_ID = '550e8400-e29b-41d4-a716-446655440000';

/**
 * The real startup chain end-to-end: auth cookie → `UserService` loads
 * `/api/user` → `SessionLifecycleService` effect → cloud library preload. The
 * unit specs mock `UserService`, so only this one covers the composition.
 */
describe('session startup (integration)', () => {
  let authCookie: ReturnType<typeof signal<string | null>>;
  let httpMock: HttpTestingController;
  let persistence: {
    createAndSetEmptyProject: Mock;
  };
  let promotion: {
    localDependenciesOfProject: Mock;
  };
  let componentLibrary: {
    preloadComponentIdAliases: Mock;
    preloadServerMasters: Mock;
    clearServerMasters: Mock;
  };

  beforeEach(() => {
    authCookie = signal<string | null>(null);
    persistence = {
      createAndSetEmptyProject: vi.fn()
    };
    promotion = {
      localDependenciesOfProject: vi.fn().mockReturnValue([])
    };
    componentLibrary = {
      preloadComponentIdAliases: vi.fn().mockResolvedValue(undefined),
      preloadServerMasters: vi.fn().mockResolvedValue(undefined),
      clearServerMasters: vi.fn()
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
      { provide: PromotionService, useValue: promotion },
      { provide: ComponentLibraryService, useValue: componentLibrary },
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

    // AppComponent-equivalent bootstrap: instantiating the lifecycle brings up
    // the real UserService, whose cookie effect fires the user load.
    TestBed.inject(SessionLifecycleService);
    TestBed.inject(UserService);
    TestBed.tick();

    const req = httpMock.expectOne(`${environment.apiUrl}/api/user`);
    req.flush(makeUser(USER_ID));
    TestBed.tick();
    await new Promise((resolve) => setTimeout(resolve));

    expect(componentLibrary.preloadServerMasters).toHaveBeenCalledTimes(1);
    expect(componentLibrary.clearServerMasters).not.toHaveBeenCalled();
  });

  it('logging in later (cookie flip) loads the cloud library', async () => {
    TestBed.inject(SessionLifecycleService);
    TestBed.inject(UserService);
    TestBed.tick();
    httpMock.expectNone(`${environment.apiUrl}/api/user`);

    authCookie.set('true');
    TestBed.tick();
    httpMock
      .expectOne(`${environment.apiUrl}/api/user`)
      .flush(makeUser(USER_ID));
    TestBed.tick();
    await new Promise((resolve) => setTimeout(resolve));

    expect(componentLibrary.preloadServerMasters).toHaveBeenCalledTimes(1);
  });
});
