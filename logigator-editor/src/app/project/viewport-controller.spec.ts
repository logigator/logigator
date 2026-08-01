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

  describe('fitBounds', () => {
    /** Grid rect currently on screen, derived from the container transform. */
    const visibleRect = (): Rectangle => viewport.gridView(new Rectangle());

    beforeEach(() => {
      viewport.resizeViewport(
        environment.gridSize * 40,
        environment.gridSize * 20
      );
    });

    it('scales so the limiting axis exactly spans the viewport', () => {
      // 20 × 5 into a 40 × 20 viewport: x needs 2, y allows 4 — x limits.
      viewport.fitBounds(new Rectangle(0, 0, 20, 5));
      expect(container.scale.x).toBeCloseTo(2, 5);
      expect(visibleRect().width).toBeCloseTo(20, 5);
    });

    it('centres the rect in the viewport', () => {
      viewport.fitBounds(new Rectangle(100, 50, 20, 5));
      const view = visibleRect();
      expect(view.x + view.width / 2).toBeCloseTo(110, 5);
      expect(view.y + view.height / 2).toBeCloseTo(52.5, 5);
    });

    it('padding counts on both sides of each axis', () => {
      // 18 wide + 1 padding per side = 20 grid units across a 40-unit viewport.
      viewport.fitBounds(new Rectangle(0, 0, 18, 5), 1);
      expect(container.scale.x).toBeCloseTo(2, 5);
      const view = visibleRect();
      expect(view.x).toBeCloseTo(-1, 5);
      expect(view.right).toBeCloseTo(19, 5);
    });

    it('clamps to the ladder maximum when the rect is tiny', () => {
      viewport.fitBounds(new Rectangle(3, 4, 0.5, 0.5));
      expect(container.scale.x).toBeCloseTo(Math.pow(1.2, 5), 5);
    });

    it('clamps to the ladder minimum when the rect is huge', () => {
      viewport.fitBounds(new Rectangle(0, 0, 100_000, 100_000));
      expect(container.scale.x).toBeCloseTo(Math.pow(1.2, -12), 5);
    });

    it('honours maxZoom instead of filling the viewport', () => {
      viewport.fitBounds(new Rectangle(0, 0, 2, 2), 0, 1);
      expect(container.scale.x).toBeCloseTo(1, 5);
      // Still centred, just not zoomed in.
      const view = visibleRect();
      expect(view.x + view.width / 2).toBeCloseTo(1, 5);
    });

    it('frames a degenerate point rect at the requested maxZoom', () => {
      viewport.fitBounds(new Rectangle(5, 5, 0, 0), 0, 2);
      expect(container.scale.x).toBeCloseTo(2, 5);
      const view = visibleRect();
      expect(view.x + view.width / 2).toBeCloseTo(5, 5);
      expect(view.y + view.height / 2).toBeCloseTo(5, 5);
    });

    it('resyncs the step so a later stepped zoomOut continues from the fit', () => {
      viewport.fitBounds(new Rectangle(0, 0, 20, 5));
      // 2 sits between 1.2^3 and 1.2^4; the nearest step is 4, so zoomOut lands on 1.2^3.
      viewport.zoomOut(new Point(0, 0));
      expect(container.scale.x).toBeCloseTo(Math.pow(1.2, 3), 5);
    });

    it('is inert before the viewport has a size', () => {
      const fresh = new ViewportController(container, grid, vi.fn(), vi.fn());
      fresh.fitBounds(new Rectangle(0, 0, 10, 10));
      expect(container.scale.x).toBe(1);
    });

    it('emits one viewport state carrying the resulting camera', () => {
      const emitted: ViewportState[] = [];
      viewport.viewportChange$.subscribe((s) => emitted.push(s));
      viewport.fitBounds(new Rectangle(0, 0, 20, 5));
      expect(emitted.length).toBe(1);
      expect(emitted[0].scale).toBeCloseTo(2, 5);
      expect(emitted[0].gridOrigin.x).toBeCloseTo(visibleRect().x, 5);
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

  describe('device-pixel snapping', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('renders the container at whole device pixels', () => {
      viewport.setPosition(new Point(10.3, 20.7));
      expect(container.position.x).toBe(10);
      expect(container.position.y).toBe(21);
    });

    it('accumulates sub-pixel pan deltas instead of rounding them away', () => {
      for (let i = 0; i < 10; i++) viewport.pan(new Point(0.3, 0));
      expect(container.position.x).toBe(3);
    });

    it('snaps to the device-pixel lattice, not CSS pixels', () => {
      vi.stubGlobal('devicePixelRatio', 2);
      viewport.setPosition(new Point(10.3, 0));
      expect(container.position.x).toBe(10.5);
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
