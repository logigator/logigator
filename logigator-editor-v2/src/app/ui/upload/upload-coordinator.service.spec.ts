import { describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { DialogService } from '@logigator/ui';
import { UploadCoordinatorService } from './upload-coordinator.service';
import { PersistenceService } from '../../persistence/persistence.service';
import { ProjectMetadataStore } from '../../persistence/project-metadata.store';
import { CustomComponentRegistry } from '../../components/custom/custom-component-registry.service';
import { ToastService } from '../../logging/toast.service';
import { Project } from '../../project/project';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { UploadDialogResult } from './upload-dialog.component';

describe('UploadCoordinatorService', () => {
  let service: UploadCoordinatorService;
  let persistence: {
    localDependenciesOfProject: ReturnType<typeof vi.fn>;
    localDependenciesOfStoredProject: ReturnType<typeof vi.fn>;
    localDependencies: ReturnType<typeof vi.fn>;
    promoteProjectToServer: ReturnType<typeof vi.fn>;
    uploadStoredProjectToServer: ReturnType<typeof vi.fn>;
    promoteComponentToServer: ReturnType<typeof vi.fn>;
    saveDraftAsServer: ReturnType<typeof vi.fn>;
    saveProject: ReturnType<typeof vi.fn>;
  };
  let toast: {
    success: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
  };
  let dialogOpen: ReturnType<typeof vi.fn>;

  function setup(dialogResult?: UploadDialogResult): void {
    persistence = {
      localDependenciesOfProject: vi.fn().mockReturnValue([]),
      localDependenciesOfStoredProject: vi.fn().mockResolvedValue([]),
      localDependencies: vi.fn().mockResolvedValue([]),
      promoteProjectToServer: vi.fn().mockResolvedValue(undefined),
      uploadStoredProjectToServer: vi.fn().mockResolvedValue(undefined),
      promoteComponentToServer: vi.fn().mockResolvedValue(undefined),
      saveDraftAsServer: vi.fn().mockResolvedValue(undefined),
      saveProject: vi.fn().mockResolvedValue(undefined)
    };
    toast = { success: vi.fn(), error: vi.fn(), warn: vi.fn() };
    dialogOpen = vi.fn().mockReturnValue({ onClose: of(dialogResult) });

    configureTestBed([
      { provide: PersistenceService, useValue: persistence },
      {
        provide: ProjectMetadataStore,
        useValue: { getMetadata: vi.fn().mockReturnValue({ name: 'P' }) }
      },
      {
        provide: CustomComponentRegistry,
        useValue: {
          getDefinition: (id: number) => ({ name: `dep-${id}` })
        }
      },
      { provide: ToastService, useValue: toast },
      { provide: DialogService, useValue: { open: dialogOpen } }
    ]);
    service = TestBed.inject(UploadCoordinatorService);
  }

  const project = {} as Project;

  it('does nothing and returns false when the dialog is cancelled', async () => {
    setup(undefined);
    const result = await service.requestUpload({ kind: 'project', project });
    expect(result).toBe(false);
    expect(persistence.promoteProjectToServer).not.toHaveBeenCalled();
  });

  it('uploads the project and toasts success when there are no dependencies', async () => {
    setup({ isPublic: true });
    const result = await service.requestUpload({ kind: 'project', project });
    expect(result).toBe(true);
    expect(persistence.promoteProjectToServer).toHaveBeenCalledWith(
      project,
      true
    );
    expect(toast.success).toHaveBeenCalledOnce();
  });

  it('promotes every resolvable dependency before the target, children-first', async () => {
    setup({ isPublic: false });
    // The analysis (not the dialog) determines what is promoted — all resolvable.
    persistence.localDependenciesOfProject.mockReturnValue([
      { name: 'a', masterTypeId: 11 },
      { name: 'b', masterTypeId: 22 }
    ]);
    const order: string[] = [];
    persistence.promoteComponentToServer.mockImplementation((id: number) => {
      order.push(`dep-${id}`);
      return Promise.resolve();
    });
    persistence.promoteProjectToServer.mockImplementation(() => {
      order.push('target');
      return Promise.resolve();
    });

    await service.requestUpload({ kind: 'project', project });

    expect(order).toEqual(['dep-11', 'dep-22', 'target']);
  });

  it('stops and does not upload the target when a dependency fails', async () => {
    setup({ isPublic: false });
    persistence.localDependenciesOfProject.mockReturnValue([
      { name: 'a', masterTypeId: 11 },
      { name: 'b', masterTypeId: 22 }
    ]);
    persistence.promoteComponentToServer.mockImplementation((id: number) =>
      id === 11 ? Promise.resolve() : Promise.reject(new Error('boom'))
    );

    const result = await service.requestUpload({ kind: 'project', project });

    expect(result).toBe(false);
    expect(persistence.promoteComponentToServer).toHaveBeenCalledTimes(2);
    expect(persistence.promoteProjectToServer).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledOnce();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('routes a component target to promoteComponentToServer', async () => {
    setup({ isPublic: true });
    const result = await service.requestUpload({
      kind: 'component',
      masterTypeId: 42
    });
    expect(result).toBe(true);
    expect(persistence.promoteComponentToServer).toHaveBeenCalledWith(42, true);
  });

  it('routes a stored-project target to uploadStoredProjectToServer', async () => {
    setup({ isPublic: false });
    await service.requestUpload({
      kind: 'stored-project',
      id: 'abc',
      name: 'Stored'
    });
    expect(persistence.uploadStoredProjectToServer).toHaveBeenCalledWith(
      'abc',
      false
    );
  });

  it('toasts and returns false when analysis throws, without prompting', async () => {
    setup({ isPublic: false });
    persistence.localDependenciesOfStoredProject.mockRejectedValue(
      new Error('no record')
    );

    const result = await service.requestUpload({
      kind: 'stored-project',
      id: 'missing',
      name: 'X'
    });

    expect(result).toBe(false);
    expect(dialogOpen).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledOnce();
  });

  describe('draft-to-server', () => {
    it('saves without a dialog when the draft has no local components', async () => {
      setup();
      persistence.localDependenciesOfProject.mockReturnValue([]);

      const result = await service.requestUpload({
        kind: 'draft-to-server',
        project,
        name: 'Fresh',
        isPublic: true
      });

      expect(result).toBe(true);
      expect(dialogOpen).not.toHaveBeenCalled();
      expect(persistence.saveDraftAsServer).toHaveBeenCalledWith(
        project,
        'Fresh',
        true
      );
      expect(toast.success).toHaveBeenCalledOnce();
    });

    it('prompts, uploads dependencies first, then saves the draft', async () => {
      setup({ isPublic: false });
      // The dialog is shown because the draft embeds local components.
      persistence.localDependenciesOfProject.mockReturnValue([
        { name: 'a', masterTypeId: 11 },
        { name: 'b', masterTypeId: 22 }
      ]);
      const order: string[] = [];
      persistence.promoteComponentToServer.mockImplementation((id: number) => {
        order.push(`dep-${id}`);
        return Promise.resolve();
      });
      persistence.saveDraftAsServer.mockImplementation(() => {
        order.push('save');
        return Promise.resolve();
      });

      const result = await service.requestUpload({
        kind: 'draft-to-server',
        project,
        name: 'Fresh',
        isPublic: true
      });

      expect(result).toBe(true);
      expect(dialogOpen).toHaveBeenCalledOnce();
      // Visibility from the save dialog is locked into the upload dialog data.
      expect(dialogOpen.mock.calls[0][1].data.presetIsPublic).toBe(true);
      expect(order).toEqual(['dep-11', 'dep-22', 'save']);
    });

    it('does not save the draft when a dependency upload fails', async () => {
      setup({ isPublic: true });
      persistence.localDependenciesOfProject.mockReturnValue([
        { name: 'a', masterTypeId: 11 }
      ]);
      persistence.promoteComponentToServer.mockRejectedValue(
        new Error('boom')
      );

      const result = await service.requestUpload({
        kind: 'draft-to-server',
        project,
        name: 'Fresh',
        isPublic: true
      });

      expect(result).toBe(false);
      expect(persistence.saveDraftAsServer).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledOnce();
    });
  });

  describe('save-server', () => {
    function setupWithMeta(dialogResult?: UploadDialogResult): void {
      setup(dialogResult);
      // getMetadata is mocked in setup() to return { name: 'P' }; add visibility
      // so the preset (project's own visibility) resolves.
      TestBed.inject(ProjectMetadataStore).getMetadata = vi
        .fn()
        .mockReturnValue({ name: 'P', isPublic: false });
    }

    it('prompts, promotes the chosen components, then re-saves the project', async () => {
      setupWithMeta({ isPublic: false });
      persistence.localDependenciesOfProject.mockReturnValue([
        { name: 'a', masterTypeId: 11 }
      ]);
      const order: string[] = [];
      persistence.promoteComponentToServer.mockImplementation((id: number) => {
        order.push(`dep-${id}`);
        return Promise.resolve();
      });
      persistence.saveProject.mockImplementation(() => {
        order.push('save');
        return Promise.resolve();
      });

      const result = await service.requestUpload({ kind: 'save-server', project });

      expect(result).toBe(true);
      expect(order).toEqual(['dep-11', 'save']);
      // saveProject reports its own outcome, so the coordinator stays quiet.
      expect(toast.success).not.toHaveBeenCalled();
    });

    it('aborts the save when the dialog is cancelled', async () => {
      setupWithMeta(undefined);
      persistence.localDependenciesOfProject.mockReturnValue([
        { name: 'a', masterTypeId: 11 }
      ]);

      const result = await service.requestUpload({ kind: 'save-server', project });

      expect(result).toBe(false);
      expect(persistence.promoteComponentToServer).not.toHaveBeenCalled();
      expect(persistence.saveProject).not.toHaveBeenCalled();
    });
  });
});
