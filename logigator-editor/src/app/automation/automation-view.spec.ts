import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import 'pixi.js/math-extras';
import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../testing/configure-test-bed';
import { makeAnd, makeWire } from '../../testing/factories';
import { setStaticDIInjector } from '../utils/get-di';
import { environment } from '../../environments/environment';
import { Project } from '../project/project';
import { ProjectService } from '../project/project.service';
import { WireDirection } from '../wires/wire-direction.enum';
import { WorkModeService } from '../work-mode/work-mode.service';
import { AutomationApiService } from './automation-api.service';

const VIEWPORT_GRID_WIDTH = 40;
const VIEWPORT_GRID_HEIGHT = 20;

describe('AutomationApiService camera and highlights', () => {
  let api: AutomationApiService;
  let project: Project;

  beforeEach(() => {
    configureTestBed();
    setStaticDIInjector(TestBed.inject(Injector));
    api = TestBed.inject(AutomationApiService);
    project = new Project();
    TestBed.inject(ProjectService).setMainProject(project);
    project.viewport.resizeViewport(
      VIEWPORT_GRID_WIDTH * environment.gridSize,
      VIEWPORT_GRID_HEIGHT * environment.gridSize
    );
  });

  afterEach(() => {
    project.destroy({ children: true });
  });

  describe('camera', () => {
    it('reports the visible grid rect, zoom and screen size', () => {
      const info = api.getViewport();
      expect(info.zoom).toBe(1);
      expect(info.view.x).toBeCloseTo(0, 10);
      expect(info.view.y).toBeCloseTo(0, 10);
      expect(info.view.width).toBeCloseTo(VIEWPORT_GRID_WIDTH, 10);
      expect(info.view.height).toBeCloseTo(VIEWPORT_GRID_HEIGHT, 10);
      expect(info.screen.width).toBe(
        VIEWPORT_GRID_WIDTH * environment.gridSize
      );
    });

    it('pans the view in grid units, positive x scrolling right', () => {
      api.cameraPan({ x: 5, y: 3 });
      const view = api.getViewport().view;
      expect(view.x).toBeCloseTo(5, 5);
      expect(view.y).toBeCloseTo(3, 5);
    });

    it('centres on a grid point', () => {
      api.cameraSetCenter({ x: 100, y: 50 });
      const view = api.getViewport().view;
      expect(view.x + view.width / 2).toBeCloseTo(100, 5);
      expect(view.y + view.height / 2).toBeCloseTo(50, 5);
    });

    it('sets an absolute zoom factor, clamped to the ladder', () => {
      api.cameraSetZoom(2);
      expect(api.getViewport().zoom).toBeCloseTo(2, 5);

      api.cameraSetZoom(1000);
      expect(api.getViewport().zoom).toBeCloseTo(Math.pow(1.2, 5), 5);
    });

    it('rejects a nonsensical zoom factor', () => {
      expect(() => api.cameraSetZoom(0)).toThrow(/positive/);
    });

    it('focus frames the union of the named elements with padding', () => {
      const a = makeAnd(2, undefined, 0, 0);
      const b = makeAnd(2, undefined, 30, 20);
      project.addComponent(a);
      project.addComponent(b);

      const info = api.cameraFocus(
        { elementIds: [a.id, b.id] },
        {
          paddingGrid: 1,
          maxZoom: 4
        }
      );

      // Both elements are inside the resulting view.
      expect(info.view.x).toBeLessThanOrEqual(a.gridBounds.x);
      expect(info.view.x + info.view.width).toBeGreaterThanOrEqual(
        b.gridBounds.right
      );
    });

    it('focus on content frames everything, wires included', () => {
      project.addComponent(makeAnd(2, undefined, 0, 0));
      project.addWire(makeWire(50, 50, WireDirection.HORIZONTAL, 4));

      const info = api.cameraFocus('content');
      const content = project.getContentBounds()!;
      expect(info.view.x).toBeLessThanOrEqual(content.x);
      expect(info.view.y + info.view.height).toBeGreaterThanOrEqual(
        content.bottom
      );
    });

    it('focus on an empty project leaves the camera alone', () => {
      const before = api.getViewport();
      expect(api.cameraFocus('content')).toEqual(before);
    });

    it('camera moves are not history entries and work while simulating', () => {
      TestBed.inject(WorkModeService).setSimulationMode(true);
      api.cameraPan({ x: 4, y: 0 });
      const view = api.cameraFocus({ x: 0, y: 0, width: 10, height: 10 }).view;
      expect(view.x + view.width / 2).toBeCloseTo(5, 5);
      expect(project.actionManager.undoAvailable).toBe(false);
    });
  });

  describe('highlights', () => {
    it('marks a region and replaces the whole set on the next call', () => {
      api.highlight([{ bounds: { x: 0, y: 0, width: 4, height: 4 } }]);
      expect(project.floatingLayer.hasHighlights).toBe(true);

      api.highlight([]);
      expect(project.floatingLayer.hasHighlights).toBe(false);
    });

    it('resolves element ids to their bounds, skipping unknown ids', () => {
      const and = makeAnd(2, undefined, 3, 3);
      project.addComponent(and);

      api.highlight([{ elementIds: [and.id, 999999] }]);
      expect(project.floatingLayer.hasHighlights).toBe(true);

      api.highlight([{ elementIds: [999999] }]);
      expect(project.floatingLayer.hasHighlights).toBe(false);
    });

    it('clear is safe with nothing highlighted', () => {
      api.clearHighlights();
      expect(project.floatingLayer.hasHighlights).toBe(false);
    });

    it('highlighting is not a history entry and works while simulating', () => {
      TestBed.inject(WorkModeService).setSimulationMode(true);
      api.highlight([{ bounds: { x: 0, y: 0, width: 2, height: 2 } }]);
      expect(project.floatingLayer.hasHighlights).toBe(true);
      expect(project.actionManager.undoAvailable).toBe(false);
    });

    it('highlights are hidden with the rest of the overlay for snapshots', () => {
      api.highlight([{ bounds: { x: 0, y: 0, width: 2, height: 2 } }]);
      project.setOverlayVisible(false);
      expect(project.floatingLayer.renderable).toBe(false);
      project.setOverlayVisible(true);
    });
  });
});
