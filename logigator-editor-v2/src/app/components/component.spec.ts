import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { setStaticDIInjector } from '../utils/get-di';
import { AndComponent } from './component-types/and/and.component';
import { andComponentConfig } from './component-types/and/and.config';
import { ComponentRotation } from './component-rotation.enum';

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
