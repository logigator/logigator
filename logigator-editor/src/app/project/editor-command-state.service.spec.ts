import 'pixi.js/math-extras';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Point } from 'pixi.js';
import { configureTestBed } from '../../testing/configure-test-bed';
import { EditorCommandStateService } from './editor-command-state.service';
import { ProjectService } from './project.service';
import { ProjectMetadataStore } from '../persistence/project-metadata.store';
import { Project } from './project';

// Its change-detection pass flushes the service's `toObservable` subscription
// effect, so the viewport stream is live before the assertions run.
@Component({
  selector: 'app-test-host',
  template: ''
})
class TestHostComponent {}

describe('EditorCommandStateService zoom predicates', () => {
  let commands: EditorCommandStateService;
  let fixture: ComponentFixture<TestHostComponent>;
  let project: Project;

  beforeEach(() => {
    configureTestBed([], [TestHostComponent]);
    commands = TestBed.inject(EditorCommandStateService);
    fixture = TestBed.createComponent(TestHostComponent);

    project = new Project();
    TestBed.inject(ProjectMetadataStore).register(project, {
      id: 'p',
      name: 'P',
      type: 'project',
      source: 'browser',
      visibility: 'private'
    });
    TestBed.inject(ProjectService).setMainProject(project);
    fixture.detectChanges();
  });

  afterEach(() => {
    project.destroy({ children: true });
  });

  it('follows the zoom range to its end and back', () => {
    expect(commands.canZoomIn()).toBe(true);
    while (project.viewport.zoomInPossible) project.viewport.zoomIn();
    expect(commands.canZoomIn()).toBe(false);
    expect(commands.canZoomOut()).toBe(true);

    project.viewport.zoomOut();
    expect(commands.canZoomIn()).toBe(true);
  });

  it('is not invalidated by a pan, which cannot change either predicate', () => {
    commands.canZoomIn();
    commands.canZoomOut();
    const zoomIn = vi.spyOn(project.viewport, 'zoomInPossible', 'get');
    const zoomOut = vi.spyOn(project.viewport, 'zoomOutPossible', 'get');

    project.viewport.pan(new Point(40, -25));
    project.viewport.pan(new Point(-3, 7));
    commands.canZoomIn();
    commands.canZoomOut();

    expect(zoomIn).not.toHaveBeenCalled();
    expect(zoomOut).not.toHaveBeenCalled();
  });
});
