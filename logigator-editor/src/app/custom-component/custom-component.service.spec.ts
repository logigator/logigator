import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { DialogService } from '@logigator/ui';
import { configureTestBed } from '../../testing/configure-test-bed';
import { CustomComponentService } from './custom-component.service';
import { UploadCoordinatorService } from '../ui/upload/upload-coordinator.service';
import { ProjectService } from '../project/project.service';
import { ProjectMetadataStore } from '../persistence/project-metadata.store';
import { PersistenceService } from '../persistence/persistence.service';
import { CustomComponentRegistry } from '../components/custom/custom-component-registry.service';
import { ComponentProviderService } from '../components/component-provider.service';
import { Project } from '../project/project';
import { CustomComponent } from '../components/custom/custom-component';
import { AddComponentsAction } from '../actions/actions/add-components.action';
import { ChangeOptionAction } from '../actions/actions/change-option.action';
import { BrowserComponentStore } from '../persistence/browser/browser-component.store';
import { BrowserProjectStore } from '../persistence/browser/browser-project.store';
import {
  FakeBrowserComponentStore,
  FakeBrowserProjectStore
} from '../../testing/fake-browser-stores';
import { makeInput } from '../../testing/factories';
import { InputComponent } from '../components/component-types/input/input.component';
import { collectSnapshots } from '../persistence/snapshots';

describe('CustomComponentService', () => {
  let service: CustomComponentService;
  let projectService: ProjectService;
  let metadataStore: ProjectMetadataStore;
  let registry: CustomComponentRegistry;
  let provider: ComponentProviderService;
  let persistence: PersistenceService;
  let main: Project;

  beforeEach(() => {
    vi.useFakeTimers();
    const fakeComponentStore = new FakeBrowserComponentStore();
    const fakeProjectStore = new FakeBrowserProjectStore();
    configureTestBed([
      { provide: BrowserComponentStore, useValue: fakeComponentStore },
      { provide: BrowserProjectStore, useValue: fakeProjectStore }
    ]);
    service = TestBed.inject(CustomComponentService);
    projectService = TestBed.inject(ProjectService);
    metadataStore = TestBed.inject(ProjectMetadataStore);
    registry = TestBed.inject(CustomComponentRegistry);
    provider = TestBed.inject(ComponentProviderService);
    persistence = TestBed.inject(PersistenceService);

    main = new Project();
    metadataStore.register(main, {
      id: 'main',
      name: 'Main',
      type: 'project',
      source: 'browser',
      hash: '',
      isPublic: false
    });
    projectService.setMainProject(main);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function masterTypeIdOf(editor: Project): number {
    return registry.masterTypeIdForId(metadataStore.getMetadata(editor)!.id)!;
  }

  // Snapshot the master and place an instance in `target`, mirroring the
  // placement session's snapshot-on-place.
  function placeInstance(
    masterTypeId: number,
    target: Project
  ): CustomComponent {
    const def = registry.snapshot(masterTypeId);
    const config = provider.getComponent(def.typeId)!;
    const instance = config.create({}) as CustomComponent;
    target.addComponent(instance);
    return instance;
  }

  it('createComponent opens an empty editor tab and activates it', async () => {
    const editor = await service.createComponent({
      name: 'Half Adder',
      symbol: 'HA',
      description: '',
      source: 'browser'
    });

    expect(projectService.openComponents()).toContain(editor);
    expect(projectService.activeProject()).toBe(editor);
    expect(metadataStore.getMetadata(editor)?.type).toBe('comp');
  });

  it('closeComponent disposes a clean editor without prompting', async () => {
    const editor = await service.createComponent({
      name: 'X',
      symbol: 'X',
      description: '',
      source: 'browser'
    });
    const open = vi.spyOn(TestBed.inject(DialogService), 'open');

    await service.closeComponent(editor);

    expect(open).not.toHaveBeenCalled();
    expect(projectService.openComponents()).not.toContain(editor);
    expect(projectService.activeProject()).toBe(main);
    expect(metadataStore.getMetadata(editor)).toBeUndefined();
  });

  it('closeComponent on a dirty editor: Discard disposes without saving', async () => {
    const editor = await service.createComponent({
      name: 'X',
      symbol: 'X',
      description: '',
      source: 'browser'
    });
    metadataStore.markDirty(editor);
    vi.spyOn(TestBed.inject(DialogService), 'open').mockReturnValue({
      onClose: of('discard')
    } as never);
    const save = vi.spyOn(
      TestBed.inject(UploadCoordinatorService),
      'promoteLocalDepsAndSave'
    );

    await service.closeComponent(editor);

    expect(save).not.toHaveBeenCalled();
    expect(projectService.openComponents()).not.toContain(editor);
  });

  it('closeComponent on a dirty editor: Save promotes+saves then disposes', async () => {
    const editor = await service.createComponent({
      name: 'X',
      symbol: 'X',
      description: '',
      source: 'browser'
    });
    metadataStore.markDirty(editor);
    vi.spyOn(TestBed.inject(DialogService), 'open').mockReturnValue({
      onClose: of('save')
    } as never);
    const save = vi
      .spyOn(
        TestBed.inject(UploadCoordinatorService),
        'promoteLocalDepsAndSave'
      )
      .mockResolvedValue(true);

    await service.closeComponent(editor);

    expect(save).toHaveBeenCalledWith(editor);
    expect(projectService.openComponents()).not.toContain(editor);
  });

  it('closeComponent on a dirty editor: Cancel keeps the tab open', async () => {
    const editor = await service.createComponent({
      name: 'X',
      symbol: 'X',
      description: '',
      source: 'browser'
    });
    metadataStore.markDirty(editor);
    // Dismissed dialog resolves undefined.
    vi.spyOn(TestBed.inject(DialogService), 'open').mockReturnValue({
      onClose: of(undefined)
    } as never);

    await service.closeComponent(editor);

    expect(projectService.openComponents()).toContain(editor);
    expect(metadataStore.getMetadata(editor)).toBeDefined();
  });

  it('keeps the master summary in sync with its plugs (DefinitionBinding)', async () => {
    const editor = await service.createComponent({
      name: 'X',
      symbol: 'X',
      description: '',
      source: 'browser'
    });
    const masterTypeId = masterTypeIdOf(editor);

    editor.actionManager.push(new AddComponentsAction(makeInput(0)));
    vi.advanceTimersByTime(1);

    expect(registry.getDefinition(masterTypeId)?.numInputs).toBe(1);
  });

  it('opens a promoted master by its current server id, not a placed snapshot stale id', async () => {
    // A local master, placed in the project (the snapshot freezes the browser id).
    const masterTypeId = registry.createMaster(
      { id: 'browser-dep', name: 'Dep', symbol: 'D' },
      'browser'
    );
    const instance = placeInstance(masterTypeId, main);
    const staleId = registry.idForTypeId(instance.config.type);
    expect(staleId).toBe('browser-dep');

    // The master is uploaded to the cloud (e.g. as a project dependency): the
    // registry flips it to a server id and keeps the old id as an alias.
    registry.promoteMaster(masterTypeId, 'srv-new', 2);

    const load = vi
      .spyOn(persistence, 'loadServerComponentForEdit')
      .mockResolvedValue({ project: new Project(), masterTypeId });

    // Editing the still-placed instance passes the frozen (old) id; it must be
    // resolved to the current server id before the API load, not sent verbatim.
    await service.openComponentForEdit(staleId!);

    expect(load).toHaveBeenCalledWith('srv-new');
  });

  // A no-provenance embedded orphan, as ingested from an `id:''` server
  // dependency (or a legacy document): no id, no version, defaulted to browser
  // origin. This is the "embedded component in a server project" case.
  function placeEmbeddedOrphan(): number {
    const orphanType = registry.registerSnapshot({
      kind: 'snapshot',
      source: 'browser',
      id: undefined,
      version: undefined,
      name: 'Orphan',
      symbol: 'O',
      description: '',
      numInputs: 0,
      numOutputs: 0,
      labels: [],
      circuit: { components: [], wires: [] }
    });
    const config = provider.getComponent(orphanType)!;
    const instance = config.create({}) as CustomComponent;
    main.addComponent(instance);
    return orphanType;
  }

  it('restoring an orphan marks the host project dirty', async () => {
    const orphanType = placeEmbeddedOrphan();
    expect(registry.resolveMaster(orphanType)).toBeUndefined();

    // A pristine, freshly-loaded project; isolate from the editor-open side
    // effect so the test asserts only the dirty flag.
    metadataStore.clearDirty(main);
    vi.spyOn(service, 'openComponentForEdit').mockResolvedValue();

    await service.restoreOrphanAndEdit(orphanType);

    // The relink changed the host's serialized content but ran no Action, so
    // restore must mark it dirty itself — otherwise the follow-up save no-ops on
    // the dirty guard and a reload shows the component embedded again.
    expect(metadataStore.isDirty(main)).toBe(true);
  });

  it('a restored orphan serializes with resolvable provenance after promotion', async () => {
    const orphanType = placeEmbeddedOrphan();
    vi.spyOn(service, 'openComponentForEdit').mockResolvedValue();

    await service.restoreOrphanAndEdit(orphanType);

    // Restore rebuilt a browser master and relinked the placed snapshot to it.
    const masterId = registry.idForTypeId(orphanType)!;
    const masterTypeId = registry.masterTypeIdForId(masterId)!;

    // Saving the server project promotes that browser master to the cloud.
    registry.promoteMaster(masterTypeId, 'srv-2', 1);

    // The re-serialized dependency must carry complete provenance (id AND
    // version) so it maps to the owned server component — otherwise it is
    // written with an empty id and reloads as an embedded orphan again.
    const { definitions } = collectSnapshots(main, registry);
    expect(definitions).toHaveLength(1);
    expect(definitions[0].source).toEqual({
      id: 'srv-2',
      version: 1,
      origin: 'server'
    });
  });

  it('a ChangeOptionAction marks the project dirty and undo reverts the value', () => {
    const input = makeInput(0);
    main.actionManager.push(new AddComponentsAction(input));
    const placed = [...main.components].find(
      (c): c is InputComponent => c instanceof InputComponent
    )!;
    metadataStore.clearDirty(main);

    main.actionManager.push(
      new ChangeOptionAction(
        placed.id,
        'label',
        placed.options.label.value,
        'A'
      )
    );

    expect(metadataStore.isDirty(main)).toBe(true);
    expect(placed.options.label.value).toBe('A');

    main.actionManager.undo();
    expect(placed.options.label.value).toBe('');
  });

  it('placed instances stay frozen when the master changes', async () => {
    const editor = await service.createComponent({
      name: 'X',
      symbol: 'X',
      description: '',
      source: 'browser'
    });
    const masterTypeId = masterTypeIdOf(editor);

    editor.actionManager.push(new AddComponentsAction(makeInput(0)));
    vi.advanceTimersByTime(1);
    const instance = placeInstance(masterTypeId, main);
    expect(instance.numInputs).toBe(1);

    // Edit the master after placing — the instance must not change.
    editor.actionManager.push(new AddComponentsAction(makeInput(1)));
    vi.advanceTimersByTime(1);
    expect(registry.getDefinition(masterTypeId)?.numInputs).toBe(2);
    expect(instance.numInputs).toBe(1);
  });

  it('buildInstanceUpdate replaces the instance with the master shape, undoable', async () => {
    const editor = await service.createComponent({
      name: 'X',
      symbol: 'X',
      description: '',
      source: 'browser'
    });
    const masterTypeId = masterTypeIdOf(editor);

    editor.actionManager.push(new AddComponentsAction(makeInput(0)));
    vi.advanceTimersByTime(1);
    const instance = placeInstance(masterTypeId, main);

    // Master grows a second input after placement.
    editor.actionManager.push(new AddComponentsAction(makeInput(1)));
    vi.advanceTimersByTime(1);

    const action = service.buildInstanceUpdate(instance)!;
    expect(action).toBeTruthy();
    main.actionManager.push(action);

    const updated = [...main.components].find(
      (c): c is CustomComponent => c instanceof CustomComponent
    )!;
    expect(updated.numInputs).toBe(2);

    main.actionManager.undo();
    const restored = [...main.components].find(
      (c): c is CustomComponent => c instanceof CustomComponent
    )!;
    expect(restored.numInputs).toBe(1);
  });
});
