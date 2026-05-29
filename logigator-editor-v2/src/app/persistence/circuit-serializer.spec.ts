import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CircuitSerializer, WIRE_TYPE_ID } from './circuit-serializer';
import { LoggingService } from '../logging/logging.service';
import { Project } from '../project/project';
import { ProjectElement } from '../api/models/project-element';
import { setStaticDIInjector } from '../utils/get-di';

interface Fixture {
	name: string;
	elements: ProjectElement[];
}

// Inlined fixtures (no JSON imports — TS doesn't have resolveJsonModule
// enabled, and inlining avoids the build-config dependency). Each fixture is a
// minimal but non-trivial circuit. The set covers:
// - Each built-in component type (NOT=1, AND=2, TEXT=7, ROM=12)
// - Non-default rotations (r=1 South, r=2 West, r=3 North)
// - Non-minimum input counts (AND with 4 inputs)
// - Distinct n[] values (ROM word≠address) so n-order regressions show
// - Wires in both directions
// - Two wires crossing (T-junction-style geometry)
// - Multi-element circuit (NOT + AND + wires)
const fixtures: Fixture[] = [
	{
		name: 'NOT gate (default rotation)',
		elements: [{ t: 1, p: [5, 3], i: 1, o: 1 }]
	},
	{
		name: 'NOT gate rotated South',
		elements: [{ t: 1, p: [5, 3], i: 1, o: 1, r: 1 }]
	},
	{
		name: 'AND gate 2 inputs',
		elements: [{ t: 2, p: [3, 4], i: 2, o: 1 }]
	},
	{
		name: 'AND gate 4 inputs rotated West',
		elements: [{ t: 2, p: [10, 10], i: 4, o: 1, r: 2 }]
	},
	{
		name: 'ROM with distinct word/address sizes',
		elements: [{ t: 12, p: [10, 5], i: 3, o: 8, n: [8, 3] }]
	},
	{
		name: 'TEXT with text and fontSize',
		elements: [{ t: 7, p: [2, 2], n: [14], s: 'Hello world' }]
	},
	{
		name: 'TEXT with rotation North',
		elements: [{ t: 7, p: [4, 4], r: 3, n: [12], s: 'sideways' }]
	},
	{
		name: 'Horizontal and vertical wires (crossing)',
		elements: [
			{ t: 0, p: [3, 5], q: [8, 5] },
			{ t: 0, p: [5, 2], q: [5, 7] }
		]
	},
	{
		name: 'Multi-component circuit (NOT + AND + wires)',
		elements: [
			{ t: 1, p: [5, 3], i: 1, o: 1 },
			{ t: 2, p: [15, 3], i: 2, o: 1 },
			{ t: 0, p: [7, 3], q: [15, 3] },
			{ t: 0, p: [10, 1], q: [10, 6] }
		]
	}
];

function normalize(elements: ProjectElement[]): string {
	const sorted = [...elements].map((el) => ({
		t: el.t,
		p: el.p,
		q: el.q ?? null,
		r: el.r ?? null,
		i: el.i ?? null,
		o: el.o ?? null,
		n: el.n ?? null,
		s: el.s ?? null
	}));
	sorted.sort((a, b) => {
		const keyA = `${a.t}-${a.p[0]}-${a.p[1]}-${a.q?.[0] ?? ''}-${a.q?.[1] ?? ''}`;
		const keyB = `${b.t}-${b.p[0]}-${b.p[1]}-${b.q?.[0] ?? ''}-${b.q?.[1] ?? ''}`;
		return keyA.localeCompare(keyB);
	});
	return JSON.stringify(sorted);
}

describe('CircuitSerializer', () => {
	let serializer: CircuitSerializer;
	let logging: LoggingService;

	beforeEach(() => {
		TestBed.configureTestingModule({});
		setStaticDIInjector(TestBed.inject(Injector));
		logging = TestBed.inject(LoggingService);
		serializer = TestBed.inject(CircuitSerializer);
	});

	describe('WIRE_TYPE_ID', () => {
		it('should be 0 (matching old editor ElementTypeId.WIRE)', () => {
			expect(WIRE_TYPE_ID).toBe(0);
		});
	});

	describe('fixture round-trip', () => {
		for (const fixture of fixtures) {
			it(`round-trips ${fixture.name}`, () => {
				const { components, wires } = serializer.deserializeProject(
					fixture.elements
				);

				const project = new Project();
				for (const c of components) project.addComponent(c);
				for (const w of wires) project.addWire(w);

				const { elements } = serializer.serializeProject(project);

				expect(normalize(elements)).toEqual(normalize(fixture.elements));
			});
		}
	});

	describe('deserializeProject edge cases', () => {
		it('skips unknown component type IDs gracefully', () => {
			const spy = spyOn(logging, 'warn');
			const elements: ProjectElement[] = [
				{ t: 99, p: [0, 0] },
				{ t: 1, p: [5, 5] }
			];

			const { components, wires } = serializer.deserializeProject(elements);

			expect(components.length).toBe(1);
			expect(components[0].config.type).toBe(1);
			expect(wires.length).toBe(0);
			expect(spy).toHaveBeenCalledWith(
				jasmine.stringContaining('Unknown component type ID: 99'),
				'CircuitSerializer'
			);
		});

		it('returns empty arrays for empty elements', () => {
			const { components, wires } = serializer.deserializeProject([]);
			expect(components.length).toBe(0);
			expect(wires.length).toBe(0);
		});

		it('returns empty dependencies from serializeProject', () => {
			const project = new Project();
			const { dependencies } = serializer.serializeProject(project);
			expect(dependencies).toEqual([]);
		});

		it('preserves ROM input/output mapping (addressSize → i, wordSize → o)', () => {
			// Regression: old editor had numInputs=addressSize, numOutputs=wordSize.
			// Bug in the new ROM constructor previously swapped these — fixed by
			// the persistence layer change.
			const elements: ProjectElement[] = [
				{ t: 12, p: [0, 0], i: 5, o: 6, n: [6, 5] }
			];

			const { components } = serializer.deserializeProject(elements);

			expect(components.length).toBe(1);
			const rom = components[0];
			expect(rom.numInputs).toBe(5);
			expect(rom.numOutputs).toBe(6);
		});
	});

	describe('wire round-trip detail', () => {
		it('correctly round-trips wire position with half-grid offset', () => {
			const elements: ProjectElement[] = [{ t: 0, p: [3, 5], q: [8, 5] }];

			const { wires } = serializer.deserializeProject(elements);
			expect(wires.length).toBe(1);
			expect(wires[0].position.x).toBe(3.5);
			expect(wires[0].position.y).toBe(5.5);

			const project = new Project();
			for (const w of wires) project.addWire(w);

			const { elements: serialized } = serializer.serializeProject(project);
			expect(serialized).toEqual(elements);
		});
	});
});
