import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { DialogService } from '@logigator/ui';
import { configureTestBed } from '../../testing/configure-test-bed';
import { CustomComponentService } from './custom-component.service';
import { ComponentLibraryService } from './component-library.service';
import { WorkModeService } from '../work-mode/work-mode.service';
import { WorkMode } from '../work-mode/work-mode.enum';
import { ServerPersistenceGateway } from '../persistence/server/server-persistence.gateway';
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
import { BuiltInComponentType } from '../components/component-type.enum';
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

  it('opening a master for edit disarms a placement armed for it', async () => {
    const masterTypeId = registry.createMaster(
      { id: 'browser-x', name: 'X', symbol: 'X' },
      'browser'
    );
    vi.spyOn(persistence, 'loadComponentForEdit').mockResolvedValue({
      project: new Project(),
      masterTypeId
    });

    // Arm the palette tile's placement, as clicking the library tile does.
    const workMode = TestBed.inject(WorkModeService);
    workMode.setMode(WorkMode.COMPONENT_PLACEMENT);
    workMode.setSelectedComponentType(masterTypeId);

    await service.openComponentForEdit('browser-x');

    // Opening its editor leaves the pan tool active, not the palette ghost.
    expect(workMode.mode()).toBe(WorkMode.PAN);
    expect(workMode.selectedComponentType()).toBeNull();
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

  // The same orphan, but with content inside, so a view tab can be checked
  // against the circuit it is supposed to be showing.
  function placeEmbeddedOrphanWithContent(): number {
    const orphanType = registry.registerSnapshot({
      kind: 'snapshot',
      source: 'server',
      id: 'someone-elses',
      version: 3,
      name: 'Borrowed',
      symbol: 'B',
      description: '',
      numInputs: 1,
      numOutputs: 0,
      labels: [],
      circuit: {
        components: [
          { type: BuiltInComponentType.INPUT, pos: [2, 3], options: {} }
        ],
        wires: [{ pos: [0, 0], direction: 0, length: 4 }]
      }
    });
    const config = provider.getComponent(orphanType)!;
    main.addComponent(config.create({}) as CustomComponent);
    return orphanType;
  }

  it('viewSnapshot opens the embedded circuit as a read-only tab', () => {
    const orphanType = placeEmbeddedOrphanWithContent();

    service.viewSnapshot(orphanType);

    const [tab] = projectService.openComponents();
    expect(projectService.activeProject()).toBe(tab);
    expect([...tab.components]).toHaveLength(1);
    expect([...tab.wires]).toHaveLength(1);

    const metadata = metadataStore.getMetadata(tab)!;
    expect(metadata.type).toBe('comp');
    expect(metadata.name).toBe('Borrowed');
    // `source: 'share'` is what makes the tab read-only: it is the flag save,
    // the File menu and the wire-repair offer all key off.
    expect(metadata.source).toBe('share');
    // No store id — the tab is backed by nothing and must not be mistaken for a
    // document that belongs somewhere.
    expect(metadata.id).toBe('');
  });

  it('viewSnapshot adds nothing to the library', async () => {
    const orphanType = placeEmbeddedOrphanWithContent();
    const componentStore = TestBed.inject(BrowserComponentStore);
    const save = vi.spyOn(componentStore, 'save');

    service.viewSnapshot(orphanType);

    expect(save).not.toHaveBeenCalled();
    expect(await componentStore.list()).toHaveLength(0);
    // The placed instance still points at an orphaned snapshot: viewing must not
    // mint a master or re-link provenance the way restore does.
    expect(registry.getDefinition(orphanType)!.kind).toBe('snapshot');
    expect(registry.resolveMaster(orphanType)).toBeUndefined();
    expect(registry.getDefinition(orphanType)!.id).toBe('someone-elses');
  });

  it('viewSnapshot never marks the host or the tab dirty', () => {
    const orphanType = placeEmbeddedOrphanWithContent();
    metadataStore.clearDirty(main);

    service.viewSnapshot(orphanType);
    const [tab] = projectService.openComponents();

    expect(metadataStore.isDirty(main)).toBe(false);
    // Dirty tracking is off, so poking at a borrowed circuit cannot arm the
    // unsaved-changes prompt on a tab that can never be saved.
    tab.addComponent(makeInput(0));
    tab.actionManager.push(new AddComponentsAction(makeInput(1)));
    expect(metadataStore.isDirty(tab)).toBe(false);
  });

  it('viewing the same snapshot twice focuses the open tab', async () => {
    const orphanType = placeEmbeddedOrphanWithContent();

    service.viewSnapshot(orphanType);
    const [tab] = projectService.openComponents();
    projectService.setActiveProject(main);
    service.viewSnapshot(orphanType);

    expect(projectService.openComponents()).toEqual([tab]);
    expect(projectService.activeProject()).toBe(tab);

    // Closing releases the entry, so a later view opens a fresh tab.
    await service.closeComponent(tab);
    service.viewSnapshot(orphanType);
    expect(projectService.openComponents()).toHaveLength(1);
    expect(projectService.openComponents()[0]).not.toBe(tab);
  });

  it('a view tab survives the logout library teardown', () => {
    const orphanType = placeEmbeddedOrphanWithContent();
    service.viewSnapshot(orphanType);
    const [tab] = projectService.openComponents();

    // Signing out drops the cloud library. A view tab is backed by the
    // document's embedded snapshot, not by a master, so it must keep rendering
    // — and its `id:''` handle must not be mistaken for an open server editor.
    TestBed.inject(ComponentLibraryService).clearServerMasters();

    expect(projectService.openComponents()).toEqual([tab]);
    expect([...tab.components]).toHaveLength(1);
    expect(registry.getDefinition(orphanType)!.kind).toBe('snapshot');
  });

  it('viewSnapshot is a no-op for a library master', () => {
    const master = registry.createMaster({ id: 'm', symbol: 'M' }, 'browser');

    service.viewSnapshot(master);

    expect(projectService.openComponents()).toHaveLength(0);
  });

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

  it('buildInstancesUpdate updates every instance in one undo entry, through one shared snapshot', async () => {
    const editor = await service.createComponent({
      name: 'X',
      symbol: 'X',
      description: '',
      source: 'browser'
    });
    const masterTypeId = masterTypeIdOf(editor);

    editor.actionManager.push(new AddComponentsAction(makeInput(0)));
    vi.advanceTimersByTime(1);
    const first = placeInstance(masterTypeId, main);
    const second = placeInstance(masterTypeId, main);
    const staleType = first.config.type;

    // Master grows a second input after both placements.
    editor.actionManager.push(new AddComponentsAction(makeInput(1)));
    vi.advanceTimersByTime(1);

    main.actionManager.push(service.buildInstancesUpdate([first, second])!);

    const updated = [...main.components].filter(
      (c): c is CustomComponent => c instanceof CustomComponent
    );
    expect(updated.map((c) => c.numInputs)).toEqual([2, 2]);
    // One re-snapshot for the whole batch, so the board (and the save file)
    // gains a single new definition rather than one per instance.
    expect(new Set(updated.map((c) => c.config.type)).size).toBe(1);
    expect(updated[0].config.type).not.toBe(staleType);

    // A single undo restores every instance, not just the last one.
    main.actionManager.undo();
    const restored = [...main.components].filter(
      (c): c is CustomComponent => c instanceof CustomComponent
    );
    expect(restored.map((c) => c.numInputs)).toEqual([1, 1]);
    expect(restored.map((c) => c.config.type)).toEqual([staleType, staleType]);
  });

  it('buildInstancesUpdate returns null when there is nothing to update', () => {
    expect(service.buildInstancesUpdate([])).toBeNull();
  });

  it('deleteComponent removes a browser master and its placed instance becomes an embedded orphan', async () => {
    const masterTypeId = registry.createMaster(
      { id: 'browser-x', name: 'X', symbol: 'X' },
      'browser'
    );
    const instance = placeInstance(masterTypeId, main);
    expect(registry.resolveMaster(instance.config.type)).toBeDefined();
    const del = vi.spyOn(TestBed.inject(BrowserComponentStore), 'delete');

    await service.deleteComponent(masterTypeId);

    // Persistent record deleted, master gone from the registry + palette.
    expect(del).toHaveBeenCalledWith('browser-x');
    expect(registry.getDefinition(masterTypeId)).toBeUndefined();
    expect(provider.getComponent(masterTypeId)).toBeUndefined();
    // The placed instance survives, now an embedded orphan (no resolvable master).
    expect(main.components).toContain(instance);
    expect(registry.resolveMaster(instance.config.type)).toBeUndefined();
  });

  it('deleteComponent unpublishes a cloud master via the API', async () => {
    const masterTypeId = registry.createMaster(
      { id: 'srv-x', name: 'X', symbol: 'X' },
      'server'
    );
    const del = vi
      .spyOn(TestBed.inject(ServerPersistenceGateway), 'deleteComponent')
      .mockReturnValue(of(undefined));

    await service.deleteComponent(masterTypeId);

    expect(del).toHaveBeenCalledWith('srv-x');
    expect(registry.getDefinition(masterTypeId)).toBeUndefined();
  });

  it('deleteComponent closes the master editor tab', async () => {
    const editor = await service.createComponent({
      name: 'X',
      symbol: 'X',
      description: '',
      source: 'browser'
    });
    const masterTypeId = masterTypeIdOf(editor);
    expect(projectService.openComponents()).toContain(editor);

    await service.deleteComponent(masterTypeId);

    expect(projectService.openComponents()).not.toContain(editor);
    expect(projectService.activeProject()).toBe(main);
    expect(registry.getDefinition(masterTypeId)).toBeUndefined();
  });

  it('deleteComponent disarms a placement armed for the deleted master', async () => {
    const masterTypeId = registry.createMaster(
      { id: 'browser-x', name: 'X', symbol: 'X' },
      'browser'
    );
    const workMode = TestBed.inject(WorkModeService);
    workMode.setMode(WorkMode.COMPONENT_PLACEMENT);
    workMode.setSelectedComponentType(masterTypeId);

    await service.deleteComponent(masterTypeId);

    expect(workMode.mode()).toBe(WorkMode.PAN);
    expect(workMode.selectedComponentType()).toBeNull();
  });

  it('updateComponentDetails persists a browser master and bumps its version', async () => {
    const editor = await service.createComponent({
      name: 'X',
      symbol: 'X',
      description: '',
      source: 'browser'
    });
    const masterTypeId = masterTypeIdOf(editor);
    const id = metadataStore.getMetadata(editor)!.id;
    const store = TestBed.inject(
      BrowserComponentStore
    ) as unknown as FakeBrowserComponentStore;
    const before = store.records.get(id)!;

    await service.updateComponentDetails(masterTypeId, {
      name: 'Y',
      symbol: 'Y2',
      description: 'desc'
    });

    // The session master carries the new details…
    const def = registry.getDefinition(masterTypeId)!;
    expect(def.name).toBe('Y');
    expect(def.symbol).toBe('Y2');
    expect(def.description).toBe('desc');
    // …and so does the persistent record. The circuit is untouched, but the
    // version is bumped — the details travel in placed snapshots, so instances
    // frozen at the older version can be offered an update.
    const record = store.records.get(id)!;
    expect(record.name).toBe('Y');
    expect(record.version).toBe(before.version + 1);
    expect(record.content).toBe(before.content);
    expect(def.version).toBe(before.version + 1);
    // The open editor tab follows the rename (its label, and the browser save
    // path persists metadata.name).
    expect(metadataStore.getMetadata(editor)?.name).toBe('Y');
  });

  it('updateComponentDetails leaves placed instances frozen but behind the master', async () => {
    const editor = await service.createComponent({
      name: 'X',
      symbol: 'X',
      description: '',
      source: 'browser'
    });
    const masterTypeId = masterTypeIdOf(editor);
    const placedBefore = placeInstance(masterTypeId, main);

    await service.updateComponentDetails(masterTypeId, {
      name: 'Y',
      symbol: 'Y2',
      description: ''
    });

    // The already-placed snapshot is frozen, now behind the master's bumped
    // version — the state that offers "Update to latest" on the instance…
    const frozen = registry.getDefinition(placedBefore.config.type)!;
    expect(frozen.name).toBe('X');
    expect(frozen.version!).toBeLessThan(
      registry.getDefinition(masterTypeId)!.version!
    );
    // …while a placement after the edit snapshots the new metadata.
    const placedAfter = placeInstance(masterTypeId, main);
    expect(registry.getDefinition(placedAfter.config.type)?.name).toBe('Y');
  });

  it('updateComponentDetails PATCHes a cloud master and adopts the returned stamps', async () => {
    const masterTypeId = registry.createMaster(
      { id: 'srv-x', name: 'X', symbol: 'X' },
      'server'
    );
    const update = vi
      .spyOn(TestBed.inject(ServerPersistenceGateway), 'updateComponentDetails')
      .mockReturnValue(of({ version: 5, lastEdited: 1234 }));

    await service.updateComponentDetails(masterTypeId, {
      name: 'Y',
      symbol: 'S',
      description: 'd'
    });

    expect(update).toHaveBeenCalledWith('srv-x', {
      name: 'Y',
      symbol: 'S',
      description: 'd'
    });
    const def = registry.getDefinition(masterTypeId)!;
    expect(def.name).toBe('Y');
    expect(def.version).toBe(5);
    expect(def.lastEdited).toBe(1234);
  });

  it('updateComponentDetails keeps the master version when the backend returns none', async () => {
    const masterTypeId = registry.createMaster(
      { id: 'srv-x', name: 'X', symbol: 'X', version: 3 },
      'server'
    );
    vi.spyOn(
      TestBed.inject(ServerPersistenceGateway),
      'updateComponentDetails'
    ).mockReturnValue(of({ version: undefined, lastEdited: 1234 }));

    await service.updateComponentDetails(masterTypeId, {
      name: 'Y',
      symbol: 'S',
      description: ''
    });

    // A backend without the additive bump returns no version: the details still
    // apply, but the master version stays put so placed instances are not
    // spuriously flagged stale.
    const def = registry.getDefinition(masterTypeId)!;
    expect(def.name).toBe('Y');
    expect(def.version).toBe(3);
  });

  it('updateComponentDetails keeps the master unchanged when the persist fails', async () => {
    const masterTypeId = registry.createMaster(
      { id: 'srv-x', name: 'X', symbol: 'X', description: 'old' },
      'server'
    );
    vi.spyOn(
      TestBed.inject(ServerPersistenceGateway),
      'updateComponentDetails'
    ).mockReturnValue(throwError(() => new Error('network')));

    await service.updateComponentDetails(masterTypeId, {
      name: 'Y',
      symbol: 'S',
      description: 'new'
    });

    // Nothing applied: the session master still shows the old details (retryable).
    const def = registry.getDefinition(masterTypeId)!;
    expect(def.name).toBe('X');
    expect(def.description).toBe('old');
  });

  it('deleteComponent keeps everything intact when the persistent delete fails', async () => {
    const masterTypeId = registry.createMaster(
      { id: 'srv-x', name: 'X', symbol: 'X' },
      'server'
    );
    const instance = placeInstance(masterTypeId, main);
    vi.spyOn(
      TestBed.inject(ServerPersistenceGateway),
      'deleteComponent'
    ).mockReturnValue(throwError(() => new Error('network')));

    await service.deleteComponent(masterTypeId);

    // Nothing removed: master still resolves, instance still linked (retryable).
    expect(registry.getDefinition(masterTypeId)).toBeDefined();
    expect(registry.resolveMaster(instance.config.type)).toBeDefined();
  });
});
