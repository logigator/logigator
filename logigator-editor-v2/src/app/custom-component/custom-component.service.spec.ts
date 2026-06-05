import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { setStaticDIInjector } from '../utils/get-di';
import { appConfig } from '../app.config';
import { CustomComponentService } from './custom-component.service';
import { ProjectService } from '../project/project.service';
import { ProjectMetadataStore } from '../persistence/project-metadata.store';
import { CustomComponentRegistry } from '../components/custom/custom-component-registry.service';
import { ComponentProviderService } from '../components/component-provider.service';
import { Project } from '../project/project';
import { CustomComponent } from '../components/custom/custom-component';
import { InputComponent } from '../components/component-types/input/input.component';
import { inputComponentConfig } from '../components/component-types/input/input.config';
import { AddComponentsAction } from '../actions/actions/add-components.action';
import { ChangeOptionAction } from '../actions/actions/change-option.action';

function makeInput(index = 0): InputComponent {
  return new InputComponent({
    direction: inputComponentConfig.options.direction.clone(),
    label: inputComponentConfig.options.label.clone(''),
    index: inputComponentConfig.options.index.clone(index)
  });
}

describe('CustomComponentService', () => {
  let service: CustomComponentService;
  let projectService: ProjectService;
  let metadataStore: ProjectMetadataStore;
  let registry: CustomComponentRegistry;
  let provider: ComponentProviderService;
  let main: Project;

  beforeEach(() => {
    jasmine.clock().install();
    TestBed.configureTestingModule({ providers: appConfig.providers });
    setStaticDIInjector(TestBed.inject(Injector));
    service = TestBed.inject(CustomComponentService);
    projectService = TestBed.inject(ProjectService);
    metadataStore = TestBed.inject(ProjectMetadataStore);
    registry = TestBed.inject(CustomComponentRegistry);
    provider = TestBed.inject(ComponentProviderService);

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
    jasmine.clock().uninstall();
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
    const instance = config.create({
      direction: config.options['direction'].clone()
    }) as CustomComponent;
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

  it('closeComponent disposes the editor and reverts to the main project', async () => {
    const editor = await service.createComponent({
      name: 'X',
      symbol: 'X',
      description: '',
      source: 'browser'
    });

    service.closeComponent(editor);

    expect(projectService.openComponents()).not.toContain(editor);
    expect(projectService.activeProject()).toBe(main);
    expect(metadataStore.getMetadata(editor)).toBeUndefined();
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
    jasmine.clock().tick(1);

    expect(registry.getDefinition(masterTypeId)?.numInputs).toBe(1);
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

    expect(metadataStore.isDirty(main)).toBeTrue();
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
    jasmine.clock().tick(1);
    const instance = placeInstance(masterTypeId, main);
    expect(instance.numInputs).toBe(1);

    // Edit the master after placing — the instance must not change.
    editor.actionManager.push(new AddComponentsAction(makeInput(1)));
    jasmine.clock().tick(1);
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
    jasmine.clock().tick(1);
    const instance = placeInstance(masterTypeId, main);

    // Master grows a second input after placement.
    editor.actionManager.push(new AddComponentsAction(makeInput(1)));
    jasmine.clock().tick(1);

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
