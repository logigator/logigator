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
import { WorkMode } from '../work-mode/work-mode.enum';
import { WorkModeService } from '../work-mode/work-mode.service';
import { serializeProjectBody } from '../persistence/snapshots';
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

  describe('highlight (region selection)', () => {
    it('selects what a marquee over the region would catch', () => {
      const inside = makeAnd(2, undefined, 1, 1);
      const outside = makeAnd(2, undefined, 30, 30);
      project.addComponent(inside);
      project.addComponent(outside);

      const state = api.highlight({
        bounds: { x: 0, y: 0, width: 10, height: 10 }
      });

      expect(state.componentIds).toEqual([inside.id]);
      expect(inside.selected).toBe(true);
      expect(outside.selected).toBe(false);
      // The drawn rect persists as the grab rect, exactly as drawn.
      expect(state.rect).toEqual({ x: 0, y: 0, width: 10, height: 10 });
      expect(state.cut).toBe(false);
    });

    it('switches to the select tool so the selection is grabbable', () => {
      const workMode = TestBed.inject(WorkModeService);
      workMode.setMode(WorkMode.PAN);
      const and = makeAnd(2, undefined, 1, 1);
      project.addComponent(and);

      api.highlight({ bounds: { x: 0, y: 0, width: 10, height: 10 } });

      expect(workMode.mode()).toBe(WorkMode.SELECT);
      expect(project.selectionManager.isGrabbedAt({ x: 2, y: 2 })).toBe(true);
    });

    it('replaces the previous selection', () => {
      const first = makeAnd(2, undefined, 1, 1);
      const second = makeAnd(2, undefined, 30, 30);
      project.addComponent(first);
      project.addComponent(second);

      api.highlight({ bounds: { x: 0, y: 0, width: 10, height: 10 } });
      const state = api.highlight({
        bounds: { x: 29, y: 29, width: 10, height: 10 }
      });

      expect(state.componentIds).toEqual([second.id]);
      expect(first.selected).toBe(false);
    });

    it('a zero-area region selects the single element under the point', () => {
      const and = makeAnd(2, undefined, 1, 1);
      project.addComponent(and);

      const state = api.highlight({
        bounds: { x: 1.5, y: 1.5, width: 0, height: 0 }
      });

      expect(state.componentIds).toEqual([and.id]);
      // A click draws nothing, so there is no persistent rect.
      expect(state.rect).toBeNull();
    });

    it('cut scissors the wires crossing the region edge', () => {
      // A wire spanning x 0.5..20.5; the region's right edge crosses it.
      const wire = makeWire(0, 5, WireDirection.HORIZONTAL, 20);
      project.addWire(wire);

      const state = api.highlight(
        { bounds: { x: 0, y: 0, width: 10, height: 10 } },
        { cut: true }
      );

      expect(state.cut).toBe(true);
      // The original is gone, replaced by pieces; the inside one is selected.
      expect(project.getWireById(wire.id)).toBeUndefined();
      expect(state.wireIds.length).toBe(1);
      expect(project.getWireById(state.wireIds[0])!.length).toBeLessThan(20);
      // The cut is a real (provisional) history entry — one Ctrl+Z reverts it.
      expect(project.actionManager.undoAvailable).toBe(true);
    });

    it('clearing after a cut retracts it, leaving no trace', () => {
      project.addWire(makeWire(0, 5, WireDirection.HORIZONTAL, 20));
      const before = serializeProjectBody(project);

      api.highlight(
        { bounds: { x: 0, y: 0, width: 10, height: 10 } },
        { cut: true }
      );
      api.clearHighlights();

      expect(serializeProjectBody(project)).toEqual(before);
      expect(project.actionManager.undoAvailable).toBe(false);
    });

    it('a plain region selection is no history entry at all', () => {
      project.addComponent(makeAnd(2, undefined, 1, 1));
      api.highlight({ bounds: { x: 0, y: 0, width: 10, height: 10 } });
      expect(project.actionManager.undoAvailable).toBe(false);
    });

    it('selects named elements directly, skipping unknown ids', () => {
      const and = makeAnd(2, undefined, 3, 3);
      project.addComponent(and);

      const state = api.highlight({ elementIds: [and.id, 999999] });

      expect(state.componentIds).toEqual([and.id]);
      expect(and.selected).toBe(true);
      // No marquee was drawn, so the rect is the padded content bounds.
      expect(state.rect).not.toBeNull();
    });

    it('refuses a cut without an edge to cut at', () => {
      const and = makeAnd(2, undefined, 3, 3);
      project.addComponent(and);
      expect(() =>
        api.highlight({ elementIds: [and.id] }, { cut: true })
      ).toThrow(/bounds region/);
    });

    it('is refused while the circuit is simulating', () => {
      TestBed.inject(WorkModeService).setSimulationMode(true);
      expect(() =>
        api.highlight({ bounds: { x: 0, y: 0, width: 4, height: 4 } })
      ).toThrow(/simulation/);
    });

    it('clear is safe with nothing selected', () => {
      api.clearHighlights();
      expect(project.selectionManager.isEmpty).toBe(true);
    });
  });
});
