import { beforeEach, describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Rectangle } from 'pixi.js';

import { ComponentSettingsComponent } from './component-settings.component';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { WorkModeService } from '../../work-mode/work-mode.service';
import { BuiltInComponentType, Direction } from '@logigator/core';
import { ProjectService } from '../../project/project.service';
import { ProjectMetadataStore } from '../../persistence/project-metadata.store';
import { Project } from '../../project/project';
import { NumberOptionInputComponent } from '../../components/component-options/number/number-option-input.component';
import { LgSelectButton } from '@logigator/ui';
import { WorkMode } from '../../work-mode/work-mode.enum';
import { makeAnd } from '../../../testing/factories';

describe('ComponentSettingsComponent', () => {
  let fixture: ComponentFixture<ComponentSettingsComponent>;
  let workModeService: WorkModeService;

  beforeEach(() => {
    configureTestBed([], [ComponentSettingsComponent]);
    workModeService = TestBed.inject(WorkModeService);
    fixture = TestBed.createComponent(ComponentSettingsComponent);
    fixture.detectChanges();
  });

  it('renders no panel while nothing is being placed or selected', () => {
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('lg-card')).toBeNull();
  });

  it('omits inspector-hidden options from the rendered form', () => {
    // The INPUT plug's options are `label` and the inspector-hidden `index`.
    // The hidden one must not render; the direction row renders regardless.
    workModeService.setSelectedComponentType(BuiltInComponentType.INPUT);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('lg-card')).not.toBeNull();
    expect(host.querySelector('app-text-input-option-input')).not.toBeNull();
    expect(host.querySelector('lg-select-button')).not.toBeNull();
    expect(host.querySelector('app-number-option-input')).toBeNull();
  });

  it('commits a placed component option edit as an undoable, dirtying action', () => {
    // A placed component's `commit` must route through ChangeOptionAction so
    // the edit is undoable and dirties the project, not write the option.
    const projectService = TestBed.inject(ProjectService);
    const metadataStore = TestBed.inject(ProjectMetadataStore);

    const project = new Project();
    const and = makeAnd();
    and.position.set(0, 0);
    project.addComponent(and);
    metadataStore.register(project, {
      id: 'p',
      name: 'P',
      type: 'project',
      source: 'browser',
      isPublic: false
    });
    projectService.setMainProject(project);
    project.selectionManager.commit(new Rectangle(0, 0, 3, 3), WorkMode.SELECT);
    fixture.detectChanges();

    const numberInput = fixture.debugElement.query(
      By.directive(NumberOptionInputComponent)
    ).componentInstance as NumberOptionInputComponent;
    // numInputs starts at 2; committing 3 must dispatch the action that applies it.
    numberInput.commit()(3);

    expect(and.options.numInputs.value).toBe(3);
    expect(metadataStore.isDirty(project)).toBe(true);

    project.actionManager.undo();
    expect(and.options.numInputs.value).toBe(2);

    project.destroy({ children: true });
  });

  it('routes a placed component direction edit through selection rotation', () => {
    // A direction change must rotate about the midpoint like the rotate
    // buttons, so it delegates to the selection-rotate command in signed
    // quarter-turns rather than pinning the body's top-left corner.
    const projectService = TestBed.inject(ProjectService);
    const metadataStore = TestBed.inject(ProjectMetadataStore);

    const project = new Project();
    const and = makeAnd();
    and.position.set(0, 0);
    project.addComponent(and);
    metadataStore.register(project, {
      id: 'p',
      name: 'P',
      type: 'project',
      source: 'browser',
      isPublic: false
    });
    projectService.setMainProject(project);
    project.selectionManager.commit(new Rectangle(0, 0, 3, 3), WorkMode.SELECT);
    fixture.detectChanges();

    const requested: number[] = [];
    const sub = project.rotateRequest$.subscribe((steps) =>
      requested.push(steps)
    );

    // For an AND gate the direction row is the only lg-select-button;
    // numInputs renders as a number input.
    const directionRow = fixture.debugElement.query(
      By.directive(LgSelectButton)
    );
    // From the default E, committing W is a half turn: two clockwise steps.
    directionRow.triggerEventHandler('ngModelChange', Direction.W);

    expect(requested).toEqual([2]);
    // The command carries the rotation; the panel never mutates the component
    // or dirties the project.
    expect(and.direction).toBe(Direction.E);
    expect(metadataStore.isDirty(project)).toBe(false);

    sub.unsubscribe();
    project.destroy({ children: true });
  });

  it('stores a placement-ghost direction edit as the sticky per-type direction', () => {
    // The ghost has no live instance to rotate: its direction row writes the
    // sticky per-type placement direction fresh ghosts start from.
    workModeService.setSelectedComponentType(BuiltInComponentType.INPUT);
    fixture.detectChanges();

    const directionRow = fixture.debugElement.query(
      By.directive(LgSelectButton)
    );
    directionRow.triggerEventHandler('ngModelChange', Direction.S);

    expect(
      workModeService.placementDirectionFor(BuiltInComponentType.INPUT)
    ).toBe(Direction.S);
    // Other types keep their own default.
    expect(
      workModeService.placementDirectionFor(BuiltInComponentType.AND)
    ).toBe(Direction.E);
  });
});
