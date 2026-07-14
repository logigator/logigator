import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'pixi.js/math-extras';
import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Container, Point, Rectangle } from 'pixi.js';
import { setStaticDIInjector } from '../utils/get-di';
import { ViewportController, ViewportState } from './viewport-controller';
import { Grid } from '../rendering/grid';
import { environment } from '../../environments/environment';

describe('ViewportController', () => {
  let viewport: ViewportController;
  let container: Container;
  let grid: Grid;
  let applyScaleSpy: Mock;

  beforeEach(() => {
    setStaticDIInjector(TestBed.inject(Injector));
    container = new Container();
    grid = new Grid();
    applyScaleSpy = vi.fn();
    viewport = new ViewportController(container, grid, applyScaleSpy, vi.fn());
  });

  afterEach(() => {
    container.destroy({ children: true });
  });

  describe('zoomIn / zoomOut', () => {
    it('zoomIn increases container scale', () => {
      viewport.zoomIn(new Point(0, 0));
      expect(container.scale.x).toBeGreaterThan(1);
    });

    it('zoomOut decreases container scale', () => {
      viewport.zoomOut(new Point(0, 0));
      expect(container.scale.x).toBeLessThan(1);
    });

    it('zoomIn then zoomOut returns to scale 1', () => {
      viewport.zoomIn(new Point(0, 0));
      viewport.zoomOut(new Point(0, 0));
      expect(container.scale.x).toBeCloseTo(1, 10);
    });

    it('zoomIn clamps at max scale steps', () => {
      // 5 max steps — calling 10 times should not exceed max
      for (let i = 0; i < 10; i++) viewport.zoomIn(new Point(0, 0));
      const maxScale = Math.pow(1.2, 5);
      expect(container.scale.x).toBeCloseTo(maxScale, 5);
    });

    it('zoomOut clamps at min scale steps', () => {
      for (let i = 0; i < 20; i++) viewport.zoomOut(new Point(0, 0));
      const minScale = Math.pow(1.2, -12);
      expect(container.scale.x).toBeCloseTo(minScale, 5);
    });

    it('zoomIn calls onApplyScale with new scale', () => {
      viewport.zoomIn(new Point(0, 0));
      expect(applyScaleSpy).toHaveBeenCalledWith(container.scale.x);
    });
  });

  describe('zoom100', () => {
    it('resets scale to 1 from any zoom level', () => {
      viewport.zoomIn(new Point(0, 0));
      viewport.zoomIn(new Point(0, 0));
      viewport.zoom100(new Point(0, 0));
      expect(container.scale.x).toBeCloseTo(1, 10);
    });

    it('subsequent zoomIn after zoom100 starts from step 1', () => {
      viewport.zoomIn(new Point(0, 0));
      viewport.zoomIn(new Point(0, 0));
      viewport.zoom100(new Point(0, 0));
      viewport.zoomIn(new Point(0, 0));
      expect(container.scale.x).toBeCloseTo(Math.pow(1.2, 1), 5);
    });
  });

  describe('zoomBy', () => {
    it('multiplies the current scale by the factor', () => {
      viewport.zoomBy(2, new Point(0, 0));
      expect(container.scale.x).toBeCloseTo(2, 5);
    });

    it('clamps to the min/max scale bounds', () => {
      viewport.zoomBy(1000, new Point(0, 0));
      expect(container.scale.x).toBeCloseTo(Math.pow(1.2, 5), 5);

      viewport.zoomBy(0.00001, new Point(0, 0));
      expect(container.scale.x).toBeCloseTo(Math.pow(1.2, -12), 5);
    });

    it('resyncs the step so a later stepped zoomIn continues from the pinched scale', () => {
      // 1.2^3 ≈ 1.728; nearest step is 3, so zoomIn should land on 1.2^4.
      viewport.zoomBy(Math.pow(1.2, 3), new Point(0, 0));
      viewport.zoomIn(new Point(0, 0));
      expect(container.scale.x).toBeCloseTo(Math.pow(1.2, 4), 5);
    });
  });

  describe('setPosition / pan', () => {
    it('setPosition updates container position', () => {
      viewport.setPosition(new Point(100, 200));
      expect(container.position.x).toBe(100);
      expect(container.position.y).toBe(200);
    });

    it('pan moves relative to current position', () => {
      viewport.setPosition(new Point(10, 20));
      viewport.pan(new Point(5, 10));
      expect(container.position.x).toBe(15);
      expect(container.position.y).toBe(30);
    });
  });

  describe('gridPosition', () => {
    it('returns origin when container is at (0,0) with scale 1', () => {
      const gp = viewport.gridPosition;
      expect(gp.x).toBeCloseTo(0, 10);
      expect(gp.y).toBeCloseTo(0, 10);
    });

    it('converts pixel position to grid units correctly', () => {
      viewport.setPosition(
        new Point(environment.gridSize * 5, environment.gridSize * 3)
      );
      const gp = viewport.gridPosition;
      expect(gp.x).toBeCloseTo(5, 5);
      expect(gp.y).toBeCloseTo(3, 5);
    });
  });

  describe('gridView', () => {
    it('covers the viewport in grid units at scale 1', () => {
      viewport.resizeViewport(
        environment.gridSize * 40,
        environment.gridSize * 30
      );
      const view = viewport.gridView(new Rectangle());
      expect(view.x).toBeCloseTo(0, 10);
      expect(view.y).toBeCloseTo(0, 10);
      expect(view.width).toBeCloseTo(40, 5);
      expect(view.height).toBeCloseTo(30, 5);
    });

    it('offsets the origin by the pan and scales the size by the zoom', () => {
      viewport.resizeViewport(
        environment.gridSize * 40,
        environment.gridSize * 30
      );
      viewport.setPosition(
        new Point(environment.gridSize * -5, environment.gridSize * -3)
      );
      viewport.zoomIn(new Point(0, 0));

      const view = viewport.gridView(new Rectangle());
      // Zoom anchored at the (panned) origin keeps the top-left corner fixed.
      expect(view.x).toBeCloseTo(5, 5);
      expect(view.y).toBeCloseTo(3, 5);
      expect(view.width).toBeCloseTo(40 / 1.2, 5);
      expect(view.height).toBeCloseTo(30 / 1.2, 5);
    });

    it('writes into and returns the passed rectangle', () => {
      const out = new Rectangle();
      expect(viewport.gridView(out)).toBe(out);
    });
  });

  describe('viewportChange$ / viewportState', () => {
    let emitted: ViewportState[];

    beforeEach(() => {
      emitted = [];
      viewport.viewportChange$.subscribe((s) => emitted.push(s));
    });

    it('viewportState reflects the current camera without a subscription', () => {
      viewport.resizeViewport(800, 600);
      viewport.setPosition(new Point(environment.gridSize * 4, 0));
      const state = viewport.viewportState;
      // gridOrigin is the visible top-left corner: -position / (scale · gridSize).
      expect(state.gridOrigin.x).toBeCloseTo(-4, 5);
      expect(state.gridOrigin.y).toBeCloseTo(0, 5);
      expect(state.scale).toBe(1);
      expect(state.viewportSize.x).toBe(800);
      expect(state.viewportSize.y).toBe(600);
    });

    it('setPosition emits one state with the updated gridOrigin', () => {
      viewport.setPosition(new Point(environment.gridSize * 2, 0));
      expect(emitted.length).toBe(1);
      expect(emitted[0].gridOrigin.x).toBeCloseTo(-2, 5);
      expect(emitted[0].scale).toBe(1);
    });

    it('pan emits the resulting state', () => {
      viewport.pan(new Point(environment.gridSize, environment.gridSize));
      expect(emitted.length).toBe(1);
      expect(emitted[0].gridOrigin.x).toBeCloseTo(-1, 5);
      expect(emitted[0].gridOrigin.y).toBeCloseTo(-1, 5);
    });

    it('zoomIn emits exactly one state, consistent with the final camera', () => {
      viewport.resizeViewport(800, 600);
      emitted.length = 0;
      viewport.zoomIn();
      expect(emitted.length).toBe(1);
      const state = emitted[0];
      expect(state.scale).toBeCloseTo(1.2, 10);
      const factor = state.scale * environment.gridSize;
      expect(state.gridOrigin.x).toBeCloseTo(-container.position.x / factor, 5);
      expect(state.gridOrigin.y).toBeCloseTo(-container.position.y / factor, 5);
    });

    it('resizeViewport emits one state carrying the new size', () => {
      viewport.resizeViewport(1024, 768);
      expect(emitted.length).toBe(1);
      expect(emitted[0].viewportSize.x).toBe(1024);
      expect(emitted[0].viewportSize.y).toBe(768);
    });

    it('a zoom that hits the clamp emits nothing', () => {
      for (let i = 0; i < 5; i++) viewport.zoomIn(new Point(0, 0));
      emitted.length = 0;
      viewport.zoomIn(new Point(0, 0));
      expect(emitted.length).toBe(0);
    });
  });

  describe('resizeViewport', () => {
    it('zoom centres on viewport middle by default', () => {
      viewport.resizeViewport(800, 600);
      // center = (400, 300), old_pos = (0,0), old_scale = 1, new_scale = 1.2
      // new_pos = center + (old_pos - center) * new_scale = (-80, -60)
      viewport.zoomIn();
      expect(container.position.x).toBeCloseTo(-80, 5);
      expect(container.position.y).toBeCloseTo(-60, 5);
    });
  });
});
