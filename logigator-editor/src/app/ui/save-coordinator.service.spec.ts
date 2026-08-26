import { describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { DialogService } from '@logigator/ui';
import { SaveCoordinatorService } from './save-coordinator.service';
import { PersistenceService } from '../persistence/persistence.service';
import { PromotionService } from '../persistence/promotion.service';
import {
  ProjectMetadata,
  ProjectMetadataStore
} from '../persistence/project-metadata.store';
import { Project } from '../project/project';
import { UploadCoordinatorService } from './upload/upload-coordinator.service';
import { configureTestBed } from '../../testing/configure-test-bed';

function meta(overrides: Partial<ProjectMetadata> = {}): ProjectMetadata {
  return {
    id: '',
    name: 'Untitled',
    type: 'project',
    source: 'browser',
    isPublic: false,
    ...overrides
  };
}

describe('SaveCoordinatorService', () => {
  let service: SaveCoordinatorService;
  let persistence: {
    saveProject: ReturnType<typeof vi.fn>;
    saveDraftAsLocal: ReturnType<typeof vi.fn>;
  };
  let promotion: {
    localDependenciesOfProject: ReturnType<typeof vi.fn>;
    saveDraftAsServer: ReturnType<typeof vi.fn>;
  };
  let uploadCoordinator: { requestUpload: ReturnType<typeof vi.fn> };
  let getMetadata: ReturnType<typeof vi.fn>;
  let dialogOpen: ReturnType<typeof vi.fn>;
  const project = {} as Project;

  function setup(dialogResult?: unknown): void {
    persistence = {
      saveProject: vi.fn().mockResolvedValue(undefined),
      saveDraftAsLocal: vi.fn().mockResolvedValue(undefined)
    };
    promotion = {
      localDependenciesOfProject: vi.fn().mockReturnValue([]),
      saveDraftAsServer: vi.fn().mockResolvedValue(undefined)
    };
    uploadCoordinator = { requestUpload: vi.fn().mockResolvedValue(true) };
    getMetadata = vi.fn();
    dialogOpen = vi.fn().mockReturnValue({ onClose: of(dialogResult) });

    configureTestBed([
      { provide: PersistenceService, useValue: persistence },
      { provide: PromotionService, useValue: promotion },
      {
        provide: UploadCoordinatorService,
        useValue: uploadCoordinator
      },
      { provide: ProjectMetadataStore, useValue: { getMetadata } },
      { provide: DialogService, useValue: { open: dialogOpen } }
    ]);
    service = TestBed.inject(SaveCoordinatorService);
  }

  it('saves an already-persisted browser project directly, no prompt', async () => {
    setup();
    getMetadata.mockReturnValue(meta({ id: 'abc' }));

    await service.requestSave(project);

    expect(dialogOpen).not.toHaveBeenCalled();
    expect(persistence.saveProject).toHaveBeenCalledWith(project);
  });

  it('saves a server project directly when it has no local components', async () => {
    setup();
    getMetadata.mockReturnValue(meta({ id: 'abc', source: 'server' }));

    await service.requestSave(project);

    expect(uploadCoordinator.requestUpload).not.toHaveBeenCalled();
    expect(persistence.saveProject).toHaveBeenCalledWith(project);
  });

  it('routes a server project with local components through the upload flow', async () => {
    setup();
    getMetadata.mockReturnValue(meta({ id: 'abc', source: 'server' }));
    promotion.localDependenciesOfProject.mockReturnValue([
      { name: 'Local', masterTypeId: 7 }
    ]);

    await service.requestSave(project);

    // The local components are promoted before the save; saveProject is called
    // by the coordinator, not directly here.
    expect(uploadCoordinator.requestUpload).toHaveBeenCalledWith({
      kind: 'save-server',
      project
    });
    expect(persistence.saveProject).not.toHaveBeenCalled();
  });

  it('treats a component editor as already-persisted, no prompt', async () => {
    setup();
    getMetadata.mockReturnValue(meta({ type: 'comp', id: '' }));

    await service.requestSave(project);

    expect(dialogOpen).not.toHaveBeenCalled();
    expect(persistence.saveProject).toHaveBeenCalledWith(project);
  });

  it('prompts a fresh draft and saves it locally', async () => {
    setup({ name: 'My Circuit', destination: 'local', isPublic: false });
    getMetadata.mockReturnValue(meta());

    await service.requestSave(project);

    expect(dialogOpen).toHaveBeenCalled();
    expect(persistence.saveDraftAsLocal).toHaveBeenCalledWith(
      project,
      'My Circuit'
    );
    expect(persistence.saveProject).not.toHaveBeenCalled();
  });

  it('routes a fresh draft server save through the upload coordinator', async () => {
    setup({ name: 'Server Circuit', destination: 'server', isPublic: true });
    getMetadata.mockReturnValue(meta());

    await service.requestSave(project);

    // The server draft goes through the upload flow (so embedded local
    // components are handled) rather than straight to saveDraftAsServer.
    expect(uploadCoordinator.requestUpload).toHaveBeenCalledWith({
      kind: 'draft-to-server',
      project,
      name: 'Server Circuit',
      isPublic: true
    });
    expect(promotion.saveDraftAsServer).not.toHaveBeenCalled();
    expect(persistence.saveDraftAsLocal).not.toHaveBeenCalled();
  });

  it('does nothing when the first-save dialog is cancelled', async () => {
    setup(undefined);
    getMetadata.mockReturnValue(meta());

    await service.requestSave(project);

    expect(dialogOpen).toHaveBeenCalled();
    expect(persistence.saveDraftAsLocal).not.toHaveBeenCalled();
    expect(promotion.saveDraftAsServer).not.toHaveBeenCalled();
    expect(persistence.saveProject).not.toHaveBeenCalled();
  });

  it('returns early when the project has no metadata', async () => {
    setup();
    getMetadata.mockReturnValue(undefined);

    await service.requestSave(project);

    expect(dialogOpen).not.toHaveBeenCalled();
    expect(persistence.saveProject).not.toHaveBeenCalled();
  });
});
