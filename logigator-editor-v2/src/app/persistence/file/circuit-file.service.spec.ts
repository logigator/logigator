import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CircuitFileService } from './circuit-file.service';
import { CircuitSerializer } from '../circuit-serializer';
import { LoggingService } from '../../logging/logging.service';
import { Project } from '../../project/project';
import { ProjectElement } from '../../api/models/project-element';
import { InvalidFileError } from './circuit-file.errors';
import { setStaticDIInjector } from '../../utils/get-di';

// Sort components/wires into a stable order so structurally-equal circuits with
// different element ordering compare equal (mirrors circuit-serializer.spec).
function normalize(json: string): string {
	const parsed = JSON.parse(json);
	const components = [...(parsed.components ?? [])].sort((a, b) =>
		`${a.type}-${a.pos[0]}-${a.pos[1]}`.localeCompare(
			`${b.type}-${b.pos[0]}-${b.pos[1]}`
		)
	);
	const wires = [...(parsed.wires ?? [])].sort((a, b) =>
		`${a.pos[0]}-${a.pos[1]}-${a.direction}`.localeCompare(
			`${b.pos[0]}-${b.pos[1]}-${b.direction}`
		)
	);
	return JSON.stringify({
		version: parsed.version,
		name: parsed.name,
		components,
		wires
	});
}

describe('CircuitFileService', () => {
	let service: CircuitFileService;
	let serializer: CircuitSerializer;
	let logging: LoggingService;

	beforeEach(() => {
		TestBed.configureTestingModule({});
		setStaticDIInjector(TestBed.inject(Injector));
		service = TestBed.inject(CircuitFileService);
		serializer = TestBed.inject(CircuitSerializer);
		logging = TestBed.inject(LoggingService);
	});

	function buildProject(elements: ProjectElement[]): Project {
		const { components, wires } = serializer.deserializeProject(elements);
		const project = new Project();
		for (const c of components) project.addComponent(c);
		for (const w of wires) project.addWire(w);
		return project;
	}

	describe('toJson', () => {
		it('encodes version, name, and named options', () => {
			const project = buildProject([{ t: 2, p: [15, 3], i: 2, o: 1 }]);
			const json = JSON.parse(service.toJson(project, 'My Circuit'));

			expect(json.version).toBe(1);
			expect(json.name).toBe('My Circuit');
			expect(json.wires).toEqual([]);
			expect(json.components.length).toBe(1);
			expect(json.components[0]).toEqual({
				type: 2,
				pos: [15, 3],
				options: { direction: 0, numInputs: 2 }
			});
		});

		it('encodes a plug with its named label/index options', () => {
			const project = buildProject([
				{ t: 100, p: [4, 4], o: 1, n: [3], s: 'CLK' }
			]);
			const json = JSON.parse(service.toJson(project, 'Plug'));

			expect(json.components.length).toBe(1);
			expect(json.components[0]).toEqual({
				type: 100,
				pos: [4, 4],
				options: { direction: 0, label: 'CLK', index: 3 }
			});
		});
	});

	describe('round-trip', () => {
		it('preserves a multi-element circuit through toJson → fromJson → toJson', () => {
			const elements: ProjectElement[] = [
				{ t: 1, p: [5, 3], i: 1, o: 1 }, // NOT
				{ t: 2, p: [15, 3], i: 2, o: 1 }, // AND
				{ t: 12, p: [10, 5], i: 3, o: 8, n: [8, 3] }, // ROM
				{ t: 7, p: [2, 2], n: [14], s: 'Hello' }, // TEXT
				{ t: 100, p: [0, 8], o: 1, n: [0], s: 'A' }, // INPUT plug
				{ t: 101, p: [20, 8], i: 1, n: [1], s: 'Q' }, // OUTPUT plug
				{ t: 0, p: [7, 3], q: [15, 3] } // wire
			];
			const project = buildProject(elements);
			const json = service.toJson(project, 'Round');

			const { components, wires } = service.fromJson(json);
			const project2 = new Project();
			for (const c of components) project2.addComponent(c);
			for (const w of wires) project2.addWire(w);
			const json2 = service.toJson(project2, 'Round');

			expect(normalize(json2)).toEqual(normalize(json));
		});
	});

	describe('fromJson', () => {
		it('reads a legacy (versionless) file by migrating it', () => {
			const legacy = JSON.stringify({
				project: { name: 'L', elements: [{ t: 1, p: [0, 0], i: 1, o: 1 }] }
			});
			const { name, components, wires } = service.fromJson(legacy);

			expect(name).toBe('L');
			expect(components.length).toBe(1);
			expect(wires.length).toBe(0);
		});

		it('throws InvalidFileError on malformed JSON', () => {
			expect(() => service.fromJson('{not json')).toThrowError(InvalidFileError);
		});

		it('throws InvalidFileError on a structurally invalid component', () => {
			const file = JSON.stringify({
				version: 1,
				name: 'x',
				components: [{ type: 1, pos: 'nope', options: {} }],
				wires: []
			});
			expect(() => service.fromJson(file)).toThrowError(InvalidFileError);
		});

		it('throws InvalidFileError on a structurally invalid wire', () => {
			const file = JSON.stringify({
				version: 1,
				name: 'x',
				components: [],
				wires: [{ pos: [0, 0], direction: 5, length: 3 }]
			});
			expect(() => service.fromJson(file)).toThrowError(InvalidFileError);
		});

		it('drops unknown component types with a warning', () => {
			const warnSpy = spyOn(logging, 'warn');
			const file = JSON.stringify({
				version: 1,
				name: 'x',
				components: [
					{ type: 99, pos: [0, 0], options: {} },
					{ type: 1, pos: [1, 1], options: {} }
				],
				wires: []
			});

			const { components } = service.fromJson(file);

			expect(components.length).toBe(1);
			expect(warnSpy).toHaveBeenCalledWith(
				jasmine.stringContaining('Unknown component type ID: 99'),
				'CircuitFileService'
			);
		});

		it('allocates fresh ids for loaded components and wires', () => {
			const json = service.toJson(
				buildProject([
					{ t: 1, p: [0, 0], i: 1, o: 1 },
					{ t: 0, p: [2, 2], q: [5, 2] }
				]),
				'Ids'
			);
			const { components, wires } = service.fromJson(json);

			expect(components[0].id).toBeGreaterThan(0);
			expect(wires[0].id).toBeGreaterThan(0);
		});
	});
});
