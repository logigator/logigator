import { beforeEach, describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Rectangle } from 'pixi.js';

import { ComponentSettingsComponent } from './component-settings.component';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { WorkModeService } from '../../work-mode/work-mode.service';
import { BuiltInComponentType } from '../../components/component-type.enum';
import { ProjectService } from '../../project/project.service';
import { ProjectMetadataStore } from '../../persistence/project-metadata.store';
import { Project } from '../../project/project';
import { NumberOptionInputComponent } from '../../components/component-options/number/number-option-input.component';
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
    // Drive the placement-ghost path with the INPUT plug, whose options are
    // `direction` (select-button), `label` (text-input) and the inspector-hidden
    // `index` (number). The hidden one must not render in the form.
    workModeService.setSelectedComponentType(BuiltInComponentType.INPUT);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('lg-card')).not.toBeNull();
    expect(host.querySelector('app-text-input-option-input')).not.toBeNull();
    expect(host.querySelector('app-select-button-option-input')).not.toBeNull();
    expect(host.querySelector('app-number-option-input')).toBeNull();
  });

  it('commits a placed component option edit as an undoable, dirtying action', () => {
    // A renderer reports an edit via its `commit` input; for a placed component
    // that must route through ChangeOptionAction (mutating the option, dirtying
    // the project, and being undoable) rather than writing the option directly.
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
      hash: '',
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
});
