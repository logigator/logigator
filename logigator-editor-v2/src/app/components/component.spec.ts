import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { setStaticDIInjector } from '../utils/get-di';
import { AndComponent } from './component-types/and/and.component';
import { andComponentConfig } from './component-types/and/and.config';
import { ComponentRotation } from './component-rotation.enum';
import { Rectangle } from 'pixi.js';

function makeAnd(numInputs = 2): AndComponent {
	return new AndComponent([
		andComponentConfig.options[0].clone(),
		andComponentConfig.options[1].clone(numInputs)
	]);
}

describe('Component.gridBounds', () => {
	beforeEach(() => {
		setStaticDIInjector(TestBed.inject(Injector));
	});

	it('includes input and output stubs (x = -0.5, right = body_width + 0.5)', () => {
		const comp = makeAnd(2);

		// AndComponent body width = 2 grid units; stubs add 0.5 on each side.
		expect(comp.gridBounds.x).toBeCloseTo(-0.5, 5);
		expect(comp.gridBounds.right).toBeCloseTo(2.5, 5);

		comp.destroy({ children: true });
	});

	it('has no phantom 0.5-unit left padding when numInputs is zero', () => {
		const comp = makeAnd(2);
		comp.numInputs = 0;

		// Without input stubs the left edge comes from the body stroke (~-sqrt(2)/gridSize),
		// which is negligible (<0.1) and well above the -0.5 that a phantom stub would add.
		expect(comp.gridBounds.x).toBeGreaterThan(-0.5);

		comp.destroy({ children: true });
	});

	it('offset by position: bounds.x = position.x - 0.5 for component with inputs', () => {
		const comp = makeAnd(2);
		comp.position.set(5, 3);
		comp.direction = ComponentRotation.Right;

		expect(comp.gridBounds.x).toBeCloseTo(5 - 0.5, 5);

		comp.destroy({ children: true });
	});
});

describe('Component.bodyGridBounds', () => {
	beforeEach(() => {
		setStaticDIInjector(TestBed.inject(Injector));
	});

	// AndComponent: bodyGridWidth=2, bodyGridHeight=max(inputs,outputs)

	it('Right: origin at position, size = body only (no stubs)', () => {
		const comp = makeAnd(2); // height=2
		comp.position.set(3, 5);
		comp.direction = ComponentRotation.Right;

		expect(comp.bodyGridBounds.x).toBeCloseTo(3, 5);
		expect(comp.bodyGridBounds.y).toBeCloseTo(5, 5);
		expect(comp.bodyGridBounds.width).toBeCloseTo(2, 5);
		expect(comp.bodyGridBounds.height).toBeCloseTo(2, 5);

		comp.destroy({ children: true });
	});

	it('Down: rotated AABB', () => {
		const comp = makeAnd(2); // bodyGridWidth=2, h=2
		comp.position.set(4, 3);
		comp.direction = ComponentRotation.Down;

		// Down: Rectangle(x - h, y, h, w) = (4-2, 3, 2, 2)
		expect(comp.bodyGridBounds.x).toBeCloseTo(2, 5);
		expect(comp.bodyGridBounds.y).toBeCloseTo(3, 5);
		expect(comp.bodyGridBounds.width).toBeCloseTo(2, 5);
		expect(comp.bodyGridBounds.height).toBeCloseTo(2, 5);

		comp.destroy({ children: true });
	});

	it('Left: rotated AABB', () => {
		const comp = makeAnd(2);
		comp.position.set(4, 4);
		comp.direction = ComponentRotation.Left;

		// Left: Rectangle(x - w, y - h, w, h) = (4-2, 4-2, 2, 2)
		expect(comp.bodyGridBounds.x).toBeCloseTo(2, 5);
		expect(comp.bodyGridBounds.y).toBeCloseTo(2, 5);
		expect(comp.bodyGridBounds.width).toBeCloseTo(2, 5);
		expect(comp.bodyGridBounds.height).toBeCloseTo(2, 5);

		comp.destroy({ children: true });
	});

	it('Up: rotated AABB', () => {
		const comp = makeAnd(2);
		comp.position.set(3, 6);
		comp.direction = ComponentRotation.Up;

		// Up: Rectangle(x, y - w, h, w) = (3, 6-2, 2, 2)
		expect(comp.bodyGridBounds.x).toBeCloseTo(3, 5);
		expect(comp.bodyGridBounds.y).toBeCloseTo(4, 5);
		expect(comp.bodyGridBounds.width).toBeCloseTo(2, 5);
		expect(comp.bodyGridBounds.height).toBeCloseTo(2, 5);

		comp.destroy({ children: true });
	});

	it('bodyGridBounds strictly inside gridBounds for all rotations', () => {
		const rotations = [
			ComponentRotation.Right,
			ComponentRotation.Down,
			ComponentRotation.Left,
			ComponentRotation.Up
		];
		for (const dir of rotations) {
			const comp = makeAnd(2);
			comp.position.set(5, 5);
			comp.direction = dir;

			const b = comp.bodyGridBounds;
			const g = comp.gridBounds;
			expect(b.x).toBeGreaterThanOrEqual(g.x);
			expect(b.y).toBeGreaterThanOrEqual(g.y);
			expect(b.right).toBeLessThanOrEqual(g.right);
			expect(b.bottom).toBeLessThanOrEqual(g.bottom);

			comp.destroy({ children: true });
		}
	});
});
