import { beforeEach, describe, expect, it } from 'vitest';
import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../testing/configure-test-bed';
import { makeAnd, makeWire } from '../../testing/factories';
import { setStaticDIInjector } from '../utils/get-di';
import { Project } from '../project/project';
import { ProjectService } from '../project/project.service';
import { ProjectMetadataStore } from '../persistence/project-metadata.store';
import { WireDirection } from '../wires/wire-direction.enum';
import { BuiltInComponentType } from '../components/component-type.enum';
import { WorkModeService } from '../work-mode/work-mode.service';
import { EditOp } from './automation-api.model';
import { AutomationApiService } from './automation-api.service';

describe('AutomationApiService', () => {
  let api: AutomationApiService;
  let project: Project;
  let projectService: ProjectService;

  beforeEach(() => {
    configureTestBed();
    setStaticDIInjector(TestBed.inject(Injector));
    api = TestBed.inject(AutomationApiService);
    projectService = TestBed.inject(ProjectService);
    project = new Project();
    projectService.setMainProject(project);
  });

  describe('getElements', () => {
    it('returns each element with the id that addresses it', () => {
      const and = makeAnd(2, undefined, 3, 4);
      const wire = makeWire(10, 10, WireDirection.HORIZONTAL, 5);
      project.addComponent(and);
      project.addWire(wire);

      const elements = api.getElements();
      expect(elements.components).toEqual([
        {
          id: and.id,
          type: BuiltInComponentType.AND,
          pos: [3, 4],
          options: { numInputs: 2 }
        }
      ]);
      expect(elements.wires).toEqual([
        {
          id: wire.id,
          pos: [10, 10],
          direction: WireDirection.HORIZONTAL,
          length: 5
        }
      ]);
    });

    it('restricts the read to the named ids of one kind only', () => {
      const and = makeAnd(2, undefined, 0, 0);
      project.addComponent(and);
      project.addWire(makeWire(10, 10, WireDirection.HORIZONTAL));

      const byComponent = api.getElements({ componentIds: [and.id] });
      expect(byComponent.components.length).toBe(1);
      expect(byComponent.wires).toEqual([]);
    });

    it('filters by grid bounds', () => {
      project.addComponent(makeAnd(2, undefined, 0, 0));
      const far = makeAnd(2, undefined, 100, 100);
      project.addComponent(far);

      const elements = api.getElements({
        bounds: { x: 99, y: 99, width: 5, height: 5 }
      });
      expect(elements.components.map((c) => c.id)).toEqual([far.id]);
    });

    it('filters components by type', () => {
      project.addComponent(makeAnd(2, undefined, 0, 0));
      expect(
        api.getElements({ types: [BuiltInComponentType.NOT] }).components
      ).toEqual([]);
      expect(
        api.getElements({ types: [BuiltInComponentType.AND] }).components.length
      ).toBe(1);
    });
  });

  describe('getProject', () => {
    it('reports the metadata, content bounds and history state', () => {
      TestBed.inject(ProjectMetadataStore).register(project, {
        id: 'abc',
        name: 'My Circuit',
        type: 'project',
        source: 'browser',
        hash: '',
        isPublic: false
      });
      project.addComponent(makeAnd(2, undefined, 2, 3));

      const state = api.getProject();
      expect(state.name).toBe('My Circuit');
      expect(state.id).toBe('abc');
      expect(state.documentType).toBe('project');
      expect(state.source).toBe('browser');
      const bounds = project.getContentBounds()!;
      expect(state.bounds).toEqual({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height
      });
      expect(state.undoAvailable).toBe(false);
      expect(state.elements.components.length).toBe(1);
    });

    it('reports null bounds for an empty project', () => {
      expect(api.getProject().bounds).toBeNull();
    });

    it('reports busy while a drag session holds the project', () => {
      expect(api.getProject().busy).toBeNull();
      project.actionManager.locked = true;
      expect(api.getProject().busy).toBe('session-active');
    });
  });

  describe('applyEdit / undo / redo', () => {
    const addAnd: EditOp = {
      op: 'addComponent',
      type: BuiltInComponentType.AND,
      pos: [0, 0],
      options: {}
    };

    it('refuses to mutate while a drag session holds the project', () => {
      project.actionManager.locked = true;
      const result = api.applyEdit([addAnd]);
      expect(result.ok).toBe(false);
      expect(!result.ok && result.errors[0].message).toContain(
        'session-active'
      );
      expect(project.componentCount).toBe(0);
    });

    it('refuses to mutate while the circuit is simulating', () => {
      TestBed.inject(WorkModeService).setSimulationMode(true);
      const result = api.applyEdit([addAnd]);
      expect(!result.ok && result.errors[0].message).toContain('simulation');
    });

    it('undo/redo report whether they had anything to do', () => {
      expect(api.undo()).toBe(false);
      api.applyEdit([addAnd]);
      expect(api.undo()).toBe(true);
      expect(project.componentCount).toBe(0);
      expect(api.redo()).toBe(true);
      expect(project.componentCount).toBe(1);
    });

    it('leaves history alone while the editor is busy', () => {
      api.applyEdit([addAnd]);
      project.actionManager.locked = true;
      expect(api.undo()).toBe(false);
      expect(project.componentCount).toBe(1);
    });
  });

  describe('install', () => {
    it('publishes a frozen facade whose methods survive destructuring', () => {
      api.install();
      const installed = window.__logigator;
      expect(Object.isFrozen(installed)).toBe(true);
      const { version } = installed!;
      expect(version().apiVersion).toBeGreaterThan(0);
      delete window.__logigator;
    });
  });
});
