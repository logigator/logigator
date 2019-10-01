import {ProjectModel} from '../project-model';
import * as PIXI from 'pixi.js';

export class TestModel {

	public static mainModel: ProjectModel = {
		board: {
			elements: [
				{
					id: 1,
					typeId: 3,
					numInputs: 2,
					numOutputs: 1,
					pos: new PIXI.Point(15, 16),
					endPos: new PIXI.Point(17, 18),
					rotation: 0
				},
				{
					id: 2,
					typeId: 1001,
					numInputs: 2,
					numOutputs: 1,
					pos: new PIXI.Point(18, 16),
					endPos: new PIXI.Point(20, 18),
					rotation: 0
				},
				{
					id: 3,
					typeId: 3,
					numInputs: 2,
					numOutputs: 1,
					pos: new PIXI.Point(21, 16),
					endPos: new PIXI.Point(23, 18),
					rotation: 0
				},
				{
					id: 4,
					typeId: 0,
					numInputs: 0,
					numOutputs: 0,
					pos: new PIXI.Point(17, 16),
					endPos: new PIXI.Point(17, 17),
					rotation: 0
				},
				{
					id: 5,
					typeId: 0,
					numInputs: 0,
					numOutputs: 0,
					pos: new PIXI.Point(20, 16),
					endPos: new PIXI.Point(20, 17),
					rotation: 0
				}
			]
		}
	};

	public static compModel: ProjectModel = {
		board: {
			elements: [
				{
					id: 1,
					typeId: 10,
					numInputs: 0,
					numOutputs: 1,
					pos: new PIXI.Point(22, 18),
					endPos: new PIXI.Point(24, 19),
					rotation: 0
				},
				{
					id: 2,
					typeId: 10,
					numInputs: 0,
					numOutputs: 1,
					pos: new PIXI.Point(22, 19),
					endPos: new PIXI.Point(24, 20),
					rotation: 0
				},
				{
					id: 3,
					typeId: 2,
					numInputs: 2,
					numOutputs: 1,
					pos: new PIXI.Point(25, 18),
					endPos: new PIXI.Point(27, 20),
					rotation: 0
				},
				{
					id: 4,
					typeId: 11,
					numInputs: 1,
					numOutputs: 0,
					pos: new PIXI.Point(28, 18),
					endPos: new PIXI.Point(30, 19),
					rotation: 0
				}
			]
		}
	};
}
