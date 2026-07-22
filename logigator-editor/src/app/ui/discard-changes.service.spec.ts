import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ConfirmationService, type Confirmation } from '@logigator/ui';
import { configureTestBed } from '../../testing/configure-test-bed';
import { ProjectService } from '../project/project.service';
import { ProjectMetadataStore } from '../persistence/project-metadata.store';
import { Project } from '../project/project';
import { DiscardChangesService } from './discard-changes.service';

describe('DiscardChangesService', () => {
  let service: DiscardChangesService;
  let confirm: ReturnType<typeof vi.fn<(config: Confirmation) => void>>;
  let mainProject: Project | null;
  let dirty: boolean;

  beforeEach(() => {
    confirm = vi.fn<(config: Confirmation) => void>();
    mainProject = {} as Project;
    dirty = false;

    configureTestBed([
      { provide: ProjectService, useValue: { mainProject: () => mainProject } },
      { provide: ProjectMetadataStore, useValue: { isDirty: () => dirty } },
      { provide: ConfirmationService, useValue: { confirm } }
    ]);
    service = TestBed.inject(DiscardChangesService);
  });

  it('resolves true without asking when the main project is clean', async () => {
    await expect(service.confirmDiscardMain()).resolves.toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('resolves true without asking when there is no main project', async () => {
    mainProject = null;
    dirty = true;
    await expect(service.confirmDiscardMain()).resolves.toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('resolves true when the user accepts discarding a dirty project', async () => {
    dirty = true;
    const result = service.confirmDiscardMain();
    confirm.mock.calls[0][0].accept!();
    await expect(result).resolves.toBe(true);
  });

  it('resolves false when the user rejects discarding a dirty project', async () => {
    dirty = true;
    const result = service.confirmDiscardMain();
    confirm.mock.calls[0][0].reject!();
    await expect(result).resolves.toBe(false);
  });
});
