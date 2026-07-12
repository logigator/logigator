import { TestBed } from '@angular/core/testing';
import * as PIXI from 'pixi.js';

import { ProjectSaveManagementService } from './project-save-management.service';
import { Element } from '../../models/element';
import { ElementTypeId } from '../../models/element-types/element-type-ids';

describe('ProjectSaveManagementService', () => {
	beforeEach(() => TestBed.configureTestingModule({}));

	it('should be created', () => {
		const service: ProjectSaveManagementService = TestBed.inject(
			ProjectSaveManagementService
		);
		expect(service).toBeTruthy();
	});

	describe('shiftIntoPositiveSpace', () => {
		// The method is pure (it only mutates the passed array), so it can be
		// exercised off the prototype without resolving the service's DI graph.
		const shift = (elements: Element[]): void =>
			(
				ProjectSaveManagementService.prototype as unknown as {
					shiftIntoPositiveSpace(elements: Element[]): void;
				}
			).shiftIntoPositiveSpace.call(null, elements);

		const makeElement = (
			pos: [number, number],
			endPos?: [number, number]
		): Element => ({
			id: 0,
			typeId: ElementTypeId.AND,
			numInputs: 2,
			numOutputs: 1,
			pos: new PIXI.Point(pos[0], pos[1]),
			endPos: endPos ? new PIXI.Point(endPos[0], endPos[1]) : undefined
		});

		it('translates negative positions into positive space', () => {
			const elements = [makeElement([-3, -5]), makeElement([1, 2])];

			shift(elements);

			expect(elements[0].pos).toEqual(new PIXI.Point(0, 0));
			expect(elements[1].pos).toEqual(new PIXI.Point(4, 7));
		});

		it('accounts for wire end points when finding the offset', () => {
			// pos is positive but endPos reaches into negative space.
			const wire = makeElement([2, 2], [-4, -1]);

			shift([wire]);

			expect(wire.pos).toEqual(new PIXI.Point(6, 3));
			expect(wire.endPos).toEqual(new PIXI.Point(0, 0));
		});

		it('leaves an all-positive project untouched', () => {
			const elements = [makeElement([0, 0]), makeElement([5, 3], [5, 8])];

			shift(elements);

			expect(elements[0].pos).toEqual(new PIXI.Point(0, 0));
			expect(elements[1].pos).toEqual(new PIXI.Point(5, 3));
			expect(elements[1].endPos).toEqual(new PIXI.Point(5, 8));
		});
	});
});
