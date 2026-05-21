import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Rectangle } from 'pixi.js';
import { setStaticDIInjector } from '../utils/get-di';
import { Project } from './project';
import { AndComponent } from '../components/component-types/and/and.component';
import { andComponentConfig } from '../components/component-types/and/and.config';

function makeAnd(numInputs = 2): AndComponent {
	return new AndComponent([
		andComponentConfig.options[0].clone(),
		andComponentConfig.options[1].clone(numInputs)
	]);
}

describe('Project.hasComponentCollision', () => {
	let project: Project;

	beforeEach(() => {
		setStaticDIInjector(TestBed.inject(Injector));
		project = new Project();
	});

	afterEach(() => {
		project.destroy({ children: true });
	});

	it('returns false for an empty project', () => {
		const bounds = new Rectangle(0, 0, 10, 10);
		expect(project.hasComponentCollision(bounds)).toBeFalse();
	});

	it('detects direct overlap with a placed component', () => {
		const comp = makeAnd(2);
		comp.position.set(3, 3);
		project.addComponent(comp);

		// Query a rect that clearly overlaps the component body
		const query = new Rectangle(3, 3, 1, 1);
		expect(project.hasComponentCollision(query)).toBeTrue();
	});

	it('allows adjacent components whose stubs touch (no collision)', () => {
		// Component A: body width 2 at (0,0), output stub reaches x=2.5
		const compA = makeAnd(2);
		compA.position.set(0, 0);
		project.addComponent(compA);

		// Component B: input stub at x=2.5 when placed at (3,0)
		const compB = makeAnd(2);
		compB.position.set(3, 0);
		// gridBounds of B: x = 3 - 0.5 = 2.5
		expect(project.hasComponentCollision(compB.gridBounds)).toBeFalse();

		compB.destroy({ children: true });
	});

	it('detects stub overlap when components are too close', () => {
		// Component A at (0,0): body width 2, output stub reaches x=2.5
		const compA = makeAnd(2);
		compA.position.set(0, 0);
		project.addComponent(compA);

		// Component B at (2,0): input stub from x=1.5 → overlaps A's output stub (0→2.5)
		const compB = makeAnd(2);
		compB.position.set(2, 0);
		// gridBounds of B: x = 2 - 0.5 = 1.5
		expect(project.hasComponentCollision(compB.gridBounds)).toBeTrue();

		compB.destroy({ children: true });
	});

	it('excludes a component when its id is in excludeIds', () => {
		const comp = makeAnd(2);
		comp.position.set(3, 3);
		project.addComponent(comp);

		const bounds = new Rectangle(3, 3, 1, 1);
		expect(
			project.hasComponentCollision(bounds, new Set([comp.id]))
		).toBeFalse();
	});
});
