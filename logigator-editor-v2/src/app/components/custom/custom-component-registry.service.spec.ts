import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { setStaticDIInjector } from '../../utils/get-di';
import { ComponentProviderService } from '../component-provider.service';
import { CUSTOM_TYPE_ID_BASE } from '../component-type.enum';
import { ComponentCategory } from '../component-category.enum';
import { CustomComponentRegistry } from './custom-component-registry.service';
import { CustomComponentDefinition } from './custom-component-definition.model';

describe('CustomComponentRegistry', () => {
	let registry: CustomComponentRegistry;
	let provider: ComponentProviderService;

	beforeEach(() => {
		setStaticDIInjector(TestBed.inject(Injector));
		registry = TestBed.inject(CustomComponentRegistry);
		provider = TestBed.inject(ComponentProviderService);
	});

	it('is created', () => {
		expect(registry).toBeTruthy();
	});

	describe('createMaster', () => {
		it('allocates ids from CUSTOM_TYPE_ID_BASE upward', () => {
			const a = registry.createMaster({ symbol: 'A' }, 'browser');
			const b = registry.createMaster({ symbol: 'B' }, 'browser');
			expect(a).toBe(CUSTOM_TYPE_ID_BASE);
			expect(b).toBe(CUSTOM_TYPE_ID_BASE + 1);
		});

		it('stores a master with the given source + summary and mints an id', () => {
			const typeId = registry.createMaster(
				{
					name: 'My Comp',
					symbol: 'MC',
					numInputs: 2,
					numOutputs: 1,
					labels: ['A', 'B', 'Q']
				},
				'browser'
			);
			const def = registry.getDefinition(typeId);
			expect(def?.kind).toBe('master');
			expect(def?.source).toBe('browser');
			expect(def?.numInputs).toBe(2);
			expect(def?.labels).toEqual(['A', 'B', 'Q']);
			expect(typeof def?.id).toBe('string');
			expect(registry.masterTypeIdForId(def!.id!)).toBe(typeId);
		});

		it('uses an explicit id (e.g. a server uuid from the create POST)', () => {
			const typeId = registry.createMaster(
				{ id: 'uuid-1', symbol: 'S' },
				'server'
			);
			expect(registry.idForTypeId(typeId)).toBe('uuid-1');
			expect(registry.masterTypeIdForId('uuid-1')).toBe(typeId);
		});

		it('registers a USER config (palette) resolvable through the provider', () => {
			const typeId = registry.createMaster({ symbol: 'MC' }, 'browser');
			const config = provider.getComponent(typeId);
			expect(config?.type).toBe(typeId);
			expect(config?.category).toBe(ComponentCategory.USER);
			expect(provider.userComponents()).toContain(config!);
		});

		it('a master config reflects later edits live (palette view)', () => {
			const typeId = registry.createMaster({ symbol: 'OLD' }, 'browser');
			const config = provider.getComponent(typeId)!;
			registry.updateDefinition(typeId, {
				numInputs: 0,
				numOutputs: 0,
				labels: [],
				symbol: 'NEW'
			});
			expect(config.symbol).toBe('NEW');
		});
	});

	describe('snapshot', () => {
		it('freezes the master state into a new snapshot type id with provenance', () => {
			const master = registry.createMaster(
				{
					id: 'uuid-1',
					symbol: 'MC',
					numInputs: 2,
					numOutputs: 1,
					labels: ['A', 'B', 'Q']
				},
				'server'
			);
			const snap = registry.snapshot(master);

			expect(snap.kind).toBe('snapshot');
			expect(snap.typeId).not.toBe(master);
			expect(snap.numInputs).toBe(2);
			expect(snap.labels).toEqual(['A', 'B', 'Q']);
			// Provenance points back at the master, but the snapshot does not own the id.
			expect(snap.id).toBe('uuid-1');
			expect(registry.idForTypeId(snap.typeId)).toBe('uuid-1');
			expect(registry.masterTypeIdForId('uuid-1')).toBe(master);
		});

		it('registers a HIDDEN config (resolvable, not in the palette)', () => {
			const master = registry.createMaster({ symbol: 'MC' }, 'browser');
			const snap = registry.snapshot(master);
			const config = provider.getComponent(snap.typeId);
			expect(config?.category).toBe(ComponentCategory.HIDDEN);
			expect(provider.userComponents()).not.toContain(config!);
		});

		it('is frozen: editing the master after snapshotting does not change the snapshot', () => {
			const master = registry.createMaster(
				{ symbol: 'MC', numInputs: 1, numOutputs: 1, labels: ['A', 'Q'] },
				'browser'
			);
			const snap = registry.snapshot(master);

			registry.updateDefinition(master, {
				numInputs: 2,
				numOutputs: 2,
				labels: ['A', 'B', 'Q', 'R']
			});

			// The earlier snapshot keeps its shape; a NEW snapshot picks up the edit.
			expect(snap.numInputs).toBe(1);
			expect(snap.labels).toEqual(['A', 'Q']);
			const snap2 = registry.snapshot(master);
			expect(snap2.numInputs).toBe(2);
			expect(snap2.labels).toEqual(['A', 'B', 'Q', 'R']);
		});

		it('throws for a non-master type id', () => {
			const master = registry.createMaster({ symbol: 'MC' }, 'browser');
			const snap = registry.snapshot(master);
			expect(() => registry.snapshot(snap.typeId)).toThrowError();
		});
	});

	describe('updateDefinition', () => {
		it('mutates the master object in place (never replaces it)', () => {
			const typeId = registry.createMaster({ numInputs: 1 }, 'browser');
			const before = registry.getDefinition(typeId);
			registry.updateDefinition(typeId, {
				numInputs: 3,
				numOutputs: 2,
				labels: ['a', 'b', 'c', 'x', 'y']
			});
			const after = registry.getDefinition(typeId);
			expect(after).toBe(before);
			expect(after?.numInputs).toBe(3);
			expect(after?.labels).toEqual(['a', 'b', 'c', 'x', 'y']);
		});

		it('no-ops for an unknown type id', () => {
			expect(() =>
				registry.updateDefinition(987654, {
					numInputs: 0,
					numOutputs: 0,
					labels: []
				})
			).not.toThrow();
		});

		it('no-ops for a snapshot (snapshots are immutable)', () => {
			const master = registry.createMaster(
				{ symbol: 'MC', numInputs: 1 },
				'browser'
			);
			const snap = registry.snapshot(master);
			registry.updateDefinition(snap.typeId, {
				numInputs: 5,
				numOutputs: 0,
				labels: []
			});
			expect(registry.getDefinition(snap.typeId)?.numInputs).toBe(1);
		});
	});

	describe('definitionChange$', () => {
		it('emits the master on update, scoped to its own type id', () => {
			const a = registry.createMaster({ symbol: 'A' }, 'browser');
			const b = registry.createMaster({ symbol: 'B' }, 'browser');

			const seenA: CustomComponentDefinition[] = [];
			const seenB: CustomComponentDefinition[] = [];
			registry.definitionChange$(a).subscribe((d) => seenA.push(d));
			registry.definitionChange$(b).subscribe((d) => seenB.push(d));

			registry.updateDefinition(a, {
				numInputs: 2,
				numOutputs: 0,
				labels: ['x', 'y']
			});

			expect(seenA.length).toBe(1);
			expect(seenA[0].typeId).toBe(a);
			expect(seenA[0].numInputs).toBe(2);
			expect(seenB.length).toBe(0);
		});

		it('does not emit for a snapshot update (no-op)', () => {
			const master = registry.createMaster({ symbol: 'MC' }, 'browser');
			const snap = registry.snapshot(master);
			const seen: CustomComponentDefinition[] = [];
			registry.definitionChange$(snap.typeId).subscribe((d) => seen.push(d));
			registry.updateDefinition(snap.typeId, {
				numInputs: 1,
				numOutputs: 0,
				labels: []
			});
			expect(seen.length).toBe(0);
		});
	});

	describe('setMasterCircuit', () => {
		it('replaces the master circuit, leaving earlier snapshots frozen', () => {
			const master = registry.createMaster(
				{
					symbol: 'M',
					circuit: {
						components: [{ type: 100, pos: [0, 0], options: {} }],
						wires: []
					}
				},
				'browser'
			);
			const snap = registry.snapshot(master);

			registry.setMasterCircuit(master, {
				components: [{ type: 101, pos: [1, 1], options: {} }],
				wires: []
			});

			// The earlier snapshot deep-copied the old circuit and is untouched.
			expect(snap.circuit?.components.map((c) => c.type)).toEqual([100]);
			// A new snapshot reflects the replaced circuit.
			expect(
				registry.snapshot(master).circuit?.components.map((c) => c.type)
			).toEqual([101]);
		});

		it('no-ops for a snapshot', () => {
			const master = registry.createMaster({ symbol: 'M' }, 'browser');
			const snap = registry.snapshot(master);
			registry.setMasterCircuit(snap.typeId, {
				components: [{ type: 1, pos: [0, 0], options: {} }],
				wires: []
			});
			expect(registry.getDefinition(snap.typeId)?.circuit).toBeUndefined();
		});
	});

	describe('ingestSnapshots', () => {
		it('registers each as a resolvable HIDDEN snapshot and returns the remap', () => {
			const remap = registry.ingestSnapshots([
				{
					type: 1000,
					source: { id: 'id-x', version: 3 },
					name: 'X',
					symbol: 'X',
					description: '',
					numInputs: 2,
					numOutputs: 1,
					labels: ['a', 'b', 'q'],
					components: [],
					wires: []
				}
			]);

			const sessionType = remap.get(1000)!;
			expect(sessionType).toBeGreaterThanOrEqual(CUSTOM_TYPE_ID_BASE);
			const def = registry.getDefinition(sessionType)!;
			expect(def.kind).toBe('snapshot');
			expect(def.id).toBe('id-x');
			expect(def.version).toBe(3);
			expect(def.numInputs).toBe(2);
			expect(provider.getComponent(sessionType)?.category).toBe(
				ComponentCategory.HIDDEN
			);
			// Snapshots are not added to the masters id index.
			expect(registry.masterTypeIdForId('id-x')).toBeUndefined();
		});
	});

	describe('library dependency graph', () => {
		it('reports direct dependencies set via setDependencies', () => {
			const a = registry.createMaster({ symbol: 'A' }, 'browser');
			const b = registry.createMaster({ symbol: 'B' }, 'browser');
			registry.setDependencies(a, [b]);
			expect([...registry.dependenciesOf(a)]).toEqual([b]);
			expect([...registry.dependenciesOf(b)]).toEqual([]);
		});

		it('computes the transitive closure of dependents (for the cycle guard)', () => {
			// C depends on B, B depends on A  =>  editing A must exclude B and C.
			const a = registry.createMaster({ symbol: 'A' }, 'browser');
			const b = registry.createMaster({ symbol: 'B' }, 'browser');
			const c = registry.createMaster({ symbol: 'C' }, 'browser');
			registry.setDependencies(b, [a]);
			registry.setDependencies(c, [b]);

			expect([...registry.dependentsOf(a)].sort()).toEqual([b, c].sort());
			expect([...registry.dependentsOf(b)]).toEqual([c]);
			expect([...registry.dependentsOf(c)]).toEqual([]);
		});

		it('terminates on a diamond without revisiting nodes', () => {
			// D depends on B and C; both depend on A.
			const a = registry.createMaster({ symbol: 'A' }, 'browser');
			const b = registry.createMaster({ symbol: 'B' }, 'browser');
			const c = registry.createMaster({ symbol: 'C' }, 'browser');
			const d = registry.createMaster({ symbol: 'D' }, 'browser');
			registry.setDependencies(b, [a]);
			registry.setDependencies(c, [a]);
			registry.setDependencies(d, [b, c]);

			expect([...registry.dependentsOf(a)].sort()).toEqual([b, c, d].sort());
		});

		describe('wouldCycle', () => {
			// C depends on B, B depends on A => editing A, placing A/B/C cycles.
			let a: number;
			let b: number;
			let c: number;
			let unrelated: number;

			beforeEach(() => {
				a = registry.createMaster({ symbol: 'A' }, 'browser');
				b = registry.createMaster({ symbol: 'B' }, 'browser');
				c = registry.createMaster({ symbol: 'C' }, 'browser');
				unrelated = registry.createMaster({ symbol: 'U' }, 'browser');
				registry.setDependencies(b, [a]);
				registry.setDependencies(c, [b]);
			});

			it('flags placing a master into its own editor', () => {
				expect(registry.wouldCycle(a, a)).toBeTrue();
			});

			it('flags placing a transitive dependent into the host', () => {
				expect(registry.wouldCycle(a, b)).toBeTrue();
				expect(registry.wouldCycle(a, c)).toBeTrue();
			});

			it('allows placing a non-dependent', () => {
				expect(registry.wouldCycle(a, unrelated)).toBeFalse();
				// Placing A into C is fine — C already depends on A, the other way.
				expect(registry.wouldCycle(c, a)).toBeFalse();
			});
		});
	});
});
