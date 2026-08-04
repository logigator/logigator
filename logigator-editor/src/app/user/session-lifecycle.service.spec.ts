import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { DialogService } from '@logigator/ui';
import { SessionLifecycleService } from './session-lifecycle.service';
import { UserService } from './user.service';
import { PersistenceService } from '../persistence/persistence.service';
import { ComponentLibraryService } from '../custom-component/component-library.service';
import { PromotionService } from '../persistence/promotion.service';
import { ProjectMetadataStore } from '../persistence/project-metadata.store';
import { ProjectService } from '../project/project.service';
import { CustomComponentService } from '../custom-component/custom-component.service';
import { UploadCoordinatorService } from '../ui/upload/upload-coordinator.service';
import { SimulationService } from '../simulation/simulation.service';
import { ToastService } from '../logging/toast.service';
import { Project } from '../project/project';
import type { UserData } from '../api/models/user';
import type { ProjectMetadata } from '../persistence/project-metadata.store';
import { configureTestBed } from '../../testing/configure-test-bed';

function makeUser(id: string): UserData {
  return { id, memberSince: '2024-01-01', username: id, image: null };
}

/** Settle the fire-and-forget async work behind the login transition. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve));
}

describe('SessionLifecycleService', () => {
  let user: ReturnType<typeof signal<UserData | null>>;
  let logout: Mock;
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
  let uploadCoordinator: { promoteLocalDepsAndSave: Mock };
  let customComponents: { forceCloseComponent: Mock };
  let simulation: { exit: Mock };
  let dialogService: { open: Mock };
  let toast: { error: Mock; warn: Mock; success: Mock };
  let metadataStore: ProjectMetadataStore;
  let projectService: ProjectService;

  beforeEach(() => {
    user = signal<UserData | null>(null);
    logout = vi.fn().mockResolvedValue(undefined);
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
    uploadCoordinator = {
      promoteLocalDepsAndSave: vi.fn().mockResolvedValue(true)
    };
    customComponents = { forceCloseComponent: vi.fn() };
    simulation = { exit: vi.fn() };
    dialogService = { open: vi.fn() };
    toast = { error: vi.fn(), warn: vi.fn(), success: vi.fn() };

    configureTestBed([
      {
        provide: UserService,
        useValue: { user, logout, sessionExpired: vi.fn() }
      },
      { provide: PersistenceService, useValue: persistence },
      { provide: PromotionService, useValue: promotion },
      { provide: ComponentLibraryService, useValue: componentLibrary },
      { provide: UploadCoordinatorService, useValue: uploadCoordinator },
      { provide: CustomComponentService, useValue: customComponents },
      { provide: SimulationService, useValue: simulation },
      { provide: DialogService, useValue: dialogService },
      { provide: ToastService, useValue: toast }
    ]);
    metadataStore = TestBed.inject(ProjectMetadataStore);
    projectService = TestBed.inject(ProjectService);
  });

  function start(): SessionLifecycleService {
    const service = TestBed.inject(SessionLifecycleService);
    TestBed.tick();
    return service;
  }

  function register(
    project: Project,
    patch: Partial<ProjectMetadata> = {}
  ): void {
    metadataStore.register(project, {
      id: 'doc-1',
      name: 'Doc',
      type: 'project',
      source: 'server',
      hash: '',
      isPublic: false,
      ...patch
    });
  }

  describe('session transitions', () => {
    it('loads the cloud library when a user signs in (aliases first)', async () => {
      start();
      expect(componentLibrary.preloadServerMasters).not.toHaveBeenCalled();

      user.set(makeUser('user-1'));
      TestBed.tick();
      await flush();

      expect(componentLibrary.preloadComponentIdAliases).toHaveBeenCalled();
      expect(componentLibrary.preloadServerMasters).toHaveBeenCalled();
    });

    it('loads the cloud library for a session that already exists at startup', async () => {
      user.set(makeUser('user-1'));
      start();
      await flush();
      expect(componentLibrary.preloadServerMasters).toHaveBeenCalled();
    });

    it('does not reload on a user-data refresh (same id)', async () => {
      user.set(makeUser('user-1'));
      start();
      await flush();
      componentLibrary.preloadServerMasters.mockClear();

      user.set({ ...makeUser('user-1'), username: 'renamed' });
      TestBed.tick();
      await flush();
      expect(componentLibrary.preloadServerMasters).not.toHaveBeenCalled();
    });

    it('clears only the library on an external logout — the workspace is untouched', () => {
      user.set(makeUser('user-1'));
      start();

      user.set(null);
      TestBed.tick();

      expect(componentLibrary.clearServerMasters).toHaveBeenCalled();
      expect(customComponents.forceCloseComponent).not.toHaveBeenCalled();
      expect(persistence.createAndSetEmptyProject).not.toHaveBeenCalled();
      expect(simulation.exit).not.toHaveBeenCalled();
    });

    it('reloads the library when a different user signs in', async () => {
      user.set(makeUser('user-1'));
      start();
      await flush();
      componentLibrary.preloadServerMasters.mockClear();

      user.set(null);
      TestBed.tick();
      user.set(makeUser('user-2'));
      TestBed.tick();
      await flush();

      expect(componentLibrary.clearServerMasters).toHaveBeenCalled();
      expect(componentLibrary.preloadServerMasters).toHaveBeenCalled();
    });
  });

  describe('requestLogout', () => {
    it('with nothing dirty: no dialog, ends the session and resets the cloud workspace', async () => {
      user.set(makeUser('user-1'));
      const service = start();

      const serverTab = new Project();
      register(serverTab, { id: 'tab-1', type: 'comp' });
      projectService.addOpenComponent(serverTab);
      const localTab = new Project();
      register(localTab, { id: 'tab-2', type: 'comp', source: 'browser' });
      projectService.addOpenComponent(localTab);
      const main = new Project();
      register(main, { id: 'main-1' });
      projectService.setMainProject(main);

      await service.requestLogout();

      expect(dialogService.open).not.toHaveBeenCalled();
      expect(logout).toHaveBeenCalled();
      expect(customComponents.forceCloseComponent).toHaveBeenCalledWith(
        serverTab
      );
      expect(customComponents.forceCloseComponent).not.toHaveBeenCalledWith(
        localTab
      );
      expect(simulation.exit).toHaveBeenCalled();
      expect(persistence.createAndSetEmptyProject).toHaveBeenCalled();
      expect(componentLibrary.clearServerMasters).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalled();
    });

    it('keeps a local main project (no blank draft, no simulation exit)', async () => {
      user.set(makeUser('user-1'));
      const service = start();
      const main = new Project();
      register(main, { id: 'local-main', source: 'browser' });
      projectService.setMainProject(main);

      await service.requestLogout();

      expect(persistence.createAndSetEmptyProject).not.toHaveBeenCalled();
      expect(simulation.exit).not.toHaveBeenCalled();
      expect(logout).toHaveBeenCalled();
    });

    it('prompts for dirty cloud documents and cancels on dismissal', async () => {
      user.set(makeUser('user-1'));
      const service = start();
      const main = new Project();
      register(main, { name: 'Dirty Cloud' });
      projectService.setMainProject(main);
      metadataStore.markDirty(main);
      dialogService.open.mockReturnValue({ onClose: of(undefined) });

      await service.requestLogout();

      expect(dialogService.open).toHaveBeenCalled();
      const config = dialogService.open.mock.calls[0][1];
      expect(config.data.items.map((i: { name: string }) => i.name)).toEqual([
        'Dirty Cloud'
      ]);
      expect(logout).not.toHaveBeenCalled();
      expect(componentLibrary.clearServerMasters).not.toHaveBeenCalled();
    });

    it('Discard logs out without saving', async () => {
      user.set(makeUser('user-1'));
      const service = start();
      const main = new Project();
      register(main);
      projectService.setMainProject(main);
      metadataStore.markDirty(main);
      dialogService.open.mockReturnValue({ onClose: of('discard') });

      await service.requestLogout();

      expect(uploadCoordinator.promoteLocalDepsAndSave).not.toHaveBeenCalled();
      expect(logout).toHaveBeenCalled();
      expect(persistence.createAndSetEmptyProject).toHaveBeenCalled();
    });

    it('Save saves every dirty cloud document before logging out', async () => {
      user.set(makeUser('user-1'));
      const service = start();
      const main = new Project();
      register(main, { id: 'main-1' });
      projectService.setMainProject(main);
      metadataStore.markDirty(main);
      const tab = new Project();
      register(tab, { id: 'tab-1', type: 'comp' });
      projectService.addOpenComponent(tab);
      metadataStore.markDirty(tab);
      dialogService.open.mockReturnValue({ onClose: of('save') });

      await service.requestLogout();

      expect(uploadCoordinator.promoteLocalDepsAndSave).toHaveBeenCalledWith(
        main
      );
      expect(uploadCoordinator.promoteLocalDepsAndSave).toHaveBeenCalledWith(
        tab
      );
      expect(logout).toHaveBeenCalled();
    });

    it('a failed save aborts the logout with the session intact', async () => {
      user.set(makeUser('user-1'));
      const service = start();
      const main = new Project();
      register(main);
      projectService.setMainProject(main);
      metadataStore.markDirty(main);
      dialogService.open.mockReturnValue({ onClose: of('save') });
      uploadCoordinator.promoteLocalDepsAndSave.mockResolvedValue(false);

      await service.requestLogout();

      expect(logout).not.toHaveBeenCalled();
      expect(componentLibrary.clearServerMasters).not.toHaveBeenCalled();
      expect(metadataStore.isDirty(main)).toBe(true);
    });

    it('a failed logout call aborts with an error and no teardown', async () => {
      user.set(makeUser('user-1'));
      const service = start();
      logout.mockRejectedValue(new Error('offline'));

      await service.requestLogout();

      expect(toast.error).toHaveBeenCalled();
      expect(componentLibrary.clearServerMasters).not.toHaveBeenCalled();
      expect(persistence.createAndSetEmptyProject).not.toHaveBeenCalled();
    });

    it('excludes foreign documents from the dialog (nothing savable ⇒ no prompt)', async () => {
      user.set(makeUser('user-1'));
      const service = start();
      const main = new Project();
      register(main);
      projectService.setMainProject(main);
      TestBed.tick(); // stamp with user-1
      metadataStore.markDirty(main);

      user.set(null);
      TestBed.tick();
      user.set(makeUser('user-2'));
      TestBed.tick();

      await service.requestLogout();

      expect(dialogService.open).not.toHaveBeenCalled();
      expect(logout).toHaveBeenCalled();
    });

    it('folds the promotion warning into the dialog when saving would publish local components', async () => {
      user.set(makeUser('user-1'));
      const service = start();
      const main = new Project();
      register(main);
      projectService.setMainProject(main);
      metadataStore.markDirty(main);
      promotion.localDependenciesOfProject.mockReturnValue([
        { name: 'Local Dep', masterTypeId: 4000 }
      ]);
      dialogService.open.mockReturnValue({ onClose: of(undefined) });

      await service.requestLogout();

      const config = dialogService.open.mock.calls[0][1];
      expect(config.data.promotionWarning).toBeDefined();
    });
  });
});
