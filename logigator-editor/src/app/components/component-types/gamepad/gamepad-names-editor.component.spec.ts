import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Rectangle } from 'pixi.js';
import { configureTestBed } from '../../../../testing/configure-test-bed';
import { makeGamepad } from '../../../../testing/factories';
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
  });

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

    const editor = document.querySelector('app-gamepad-names-editor');
    expect(editor).not.toBeNull();
    const inputs = [
      ...editor!.querySelectorAll<HTMLInputElement>('input[data-control]')
    ];
    expect(inputs.map((input) => input.dataset['control'])).toEqual(
      pad.slotIds
    );

    const history = project.actionManager.history.length;
    const typeInto = (control: string, value: string): HTMLInputElement => {
      const input = inputs.find((i) => i.dataset['control'] === control)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      return input;
    };
    typeInto('a', 'Jump');
    typeInto('up', ' Fly ');
    typeInto('start', 'Pause').dispatchEvent(
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
});
