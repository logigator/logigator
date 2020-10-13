import {ProjectModel} from '../../src/app/models/project-model';
import * as PIXI from 'pixi.js';

export const basicModel: ProjectModel = {
	board: {
		elements: [
			{
				id: 0,
				typeId: 1,
				numInputs: 2,
				numOutputs: 1,
				pos: new PIXI.Point(17, 1),
				endPos: new PIXI.Point(19, 2),
				rotation: 0
			},
			{
				id: 1,
				typeId: 0,
				numInputs: 2,
				numOutputs: 1,
				pos: new PIXI.Point(30, 30),
				endPos: new PIXI.Point(50, 30),
				rotation: 0
			},
			{
				id: 3,
				typeId: 0,
				numInputs: 2,
				numOutputs: 1,
				pos: new PIXI.Point(40, 25),
				endPos: new PIXI.Point(40, 35),
				rotation: 0
			},
			{
				id: 2,
				typeId: 2,
				numInputs: 2,
				numOutputs: 1,
				pos: new PIXI.Point(5, 5),
				endPos: new PIXI.Point(7, 7),
				rotation: 0
			}
		]
	}
};
