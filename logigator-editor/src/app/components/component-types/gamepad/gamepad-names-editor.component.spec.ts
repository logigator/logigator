import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Rectangle } from 'pixi.js';
import { BuiltInComponentType, gamepadMeta } from '@logigator/core';
import { configureTestBed } from '../../../../testing/configure-test-bed';
import { makeGamepad, makeMoveInput } from '../../../../testing/factories';
import { CustomComponentService } from '../../../custom-component/custom-component.service';
import { WorkModeRouter } from '../../../rendering/interaction/work-mode-router';
import { WorkModeService } from '../../../work-mode/work-mode.service';
import { SelectButtonOptionInputComponent } from '../../component-options/select-button/select-button-option-input.component';
import { GamepadComponent } from './gamepad.component';
import { gamepadComponentConfig } from './gamepad.config';
import { ProjectMetadataStore } from '../../../persistence/project-metadata.store';
import { Project } from '../../../project/project';
import { ProjectService } from '../../../project/project.service';
import { ComponentSettingsComponent } from '../../../ui/component-settings/component-settings.component';
import { WorkMode } from '../../../work-mode/work-mode.enum';

describe('GamepadNamesEditorComponent in the settings panel', () => {
  let project: Project;

  beforeEach(() => {
    configureTestBed([], [ComponentSettingsComponent]);
  });

  afterEach(() => {
    document.querySelector('.cdk-overlay-container')?.replaceChildren();
    project.destroy({ children: true });
    // The placement form writes the config's own options.
    const template = gamepadComponentConfig.options;
    template.face.value = gamepadMeta.options.face.default;
    template.menu.value = gamepadMeta.options.menu.default;
    template.names.value = gamepadMeta.options.names.default;
  });

  /** The names editor's inputs, in the order it lists the controls. */
  function editorInputs(): HTMLInputElement[] {
    const editor = document.querySelector('app-gamepad-names-editor');
    expect(editor).not.toBeNull();
    return [
      ...editor!.querySelectorAll<HTMLInputElement>('input[data-control]')
    ];
  }

  function typeInto(
    inputs: HTMLInputElement[],
    control: string,
    value: string
  ): HTMLInputElement {
    const input = inputs.find((i) => i.dataset['control'] === control)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    return input;
  }

  it('edits a placed pad’s names on its own controls and saves them as one undo step', () => {
    project = new Project();
    const pad = makeGamepad({ face: 2, menu: 1, names: { b: 'Fire' } });
    project.addComponent(pad);
    TestBed.inject(ProjectMetadataStore).register(project, {
      id: 'p',
      name: 'P',
      type: 'project',
      source: 'browser',
      visibility: 'private'
    });
    TestBed.inject(ProjectService).setMainProject(project);
    project.selectionManager.commit(
      new Rectangle(-1, -1, 20, 20),
      WorkMode.SELECT
    );
    const fixture = TestBed.createComponent(ComponentSettingsComponent);
    fixture.detectChanges();
    const appRef = TestBed.inject(ApplicationRef);

    const row = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLElement>('app-name-map-option-input button');
    expect(row).not.toBeNull();
    row!.click();
    appRef.tick();

    const inputs = editorInputs();
    expect(inputs.map((input) => input.dataset['control'])).toEqual(
      pad.slotIds
    );

    const history = project.actionManager.history.length;
    typeInto(inputs, 'a', 'Jump');
    typeInto(inputs, 'up', ' Fly ');
    typeInto(inputs, 'start', 'Pause').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    );
    appRef.tick();

    expect(document.querySelector('app-gamepad-names-editor')).toBeNull();
    expect(project.actionManager.history.length).toBe(history + 1);
    expect(pad.options.names.value).toEqual({
      up: 'Fly',
      a: 'Jump',
      b: 'Fire',
      start: 'Pause'
    });

    project.actionManager.undo();
    expect(pad.options.names.value).toEqual({ b: 'Fire' });
  });

  it('names the controls a placement ghost has now, and places the pad with them', async () => {
    project = new Project();
    TestBed.inject(ProjectService).setMainProject(project);
    const workMode = TestBed.inject(WorkModeService);
    workMode.setMode(WorkMode.COMPONENT_PLACEMENT);
    workMode.setSelectedComponentType(BuiltInComponentType.GAMEPAD);
    const fixture = TestBed.createComponent(ComponentSettingsComponent);
    fixture.detectChanges();
    const appRef = TestBed.inject(ApplicationRef);

    // Four face buttons and no menu buttons, chosen in the placement form.
    const template = gamepadComponentConfig.options;
    const selects = fixture.debugElement
      .queryAll(By.directive(SelectButtonOptionInputComponent))
      .map(
        (row) =>
          row.componentInstance as SelectButtonOptionInputComponent<number>
      );
    selects.find((row) => row.option() === template.face)!.commit()(4);
    selects.find((row) => row.option() === template.menu)!.commit()(0);
    fixture.detectChanges();

    const row = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLElement>('app-name-map-option-input button');
    expect(row).not.toBeNull();
    row!.click();
    appRef.tick();

    const inputs = editorInputs();
    const controls = ['up', 'down', 'left', 'right', 'a', 'b', 'x', 'y'];
    expect(inputs.map((input) => input.dataset['control'])).toEqual(controls);
    typeInto(inputs, 'x', 'Dash').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    );
    appRef.tick();
    expect(document.querySelector('app-gamepad-names-editor')).toBeNull();

    vi.spyOn(
      TestBed.inject(CustomComponentService),
      'ensureMasterCircuit'
    ).mockResolvedValue(true);
    const router = new WorkModeRouter();
    router.setProject(project);
    router.setMode(workMode.mode());
    router.componentToPlace = workMode.selectedComponentConfig();
    router.down(makeMoveInput(10, 10));
    await Promise.resolve();
    await Promise.resolve();
    router.up();
    router.destroy();

    const placedPads = () =>
      [...project.components].filter(
        (component) => component instanceof GamepadComponent
      );
    const [placed] = placedPads();
    expect(placed.slotIds).toEqual(controls);
    expect(placed.options.names.value).toEqual({ x: 'Dash' });

    project.actionManager.undo();
    expect(placedPads()).toEqual([]);
    project.actionManager.redo();
    expect(placedPads().map((pad) => pad.options.names.value)).toEqual([
      { x: 'Dash' }
    ]);
  });
});
