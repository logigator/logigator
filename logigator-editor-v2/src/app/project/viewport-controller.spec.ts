import 'pixi.js/math-extras';
import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Container, Point } from 'pixi.js';
import { setStaticDIInjector } from '../utils/get-di';
import { ViewportController } from './viewport-controller';
import { Grid } from '../rendering/grid';
import { environment } from '../../environments/environment';

describe('ViewportController', () => {
	let viewport: ViewportController;
	let container: Container;
	let grid: Grid;
	let applyScaleSpy: jasmine.Spy;

	beforeEach(() => {
		setStaticDIInjector(TestBed.inject(Injector));
		container = new Container();
		grid = new Grid();
		applyScaleSpy = jasmine.createSpy('onApplyScale');
		viewport = new ViewportController(container, grid, applyScaleSpy);
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

		it('setPosition emits updated gridPosition via positionChange$', () => {
			const emitted: Point[] = [];
			viewport.positionChange$.subscribe((p) => emitted.push(p));
			viewport.setPosition(new Point(100, 200));
			expect(emitted.length).toBe(1);
			// gridPosition = position / (scale * gridSize)
			const expected = 100 / (1 * environment.gridSize);
			expect(emitted[0].x).toBeCloseTo(expected, 5);
		});
	});

	describe('gridPosition', () => {
		it('returns origin when container is at (0,0) with scale 1', () => {
			const gp = viewport.gridPosition;
			expect(gp.x).toBeCloseTo(0, 10);
			expect(gp.y).toBeCloseTo(0, 10);
		});

		it('converts pixel position to grid units correctly', () => {
			viewport.setPosition(new Point(environment.gridSize * 5, environment.gridSize * 3));
			const gp = viewport.gridPosition;
			expect(gp.x).toBeCloseTo(5, 5);
			expect(gp.y).toBeCloseTo(3, 5);
		});
	});

	describe('resizeViewport', () => {
		it('does not throw when called', () => {
			expect(() => viewport.resizeViewport(800, 600)).not.toThrow();
		});

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
