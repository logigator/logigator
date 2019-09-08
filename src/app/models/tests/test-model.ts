import {ProjectModel} from '../project-model';
import * as PIXI from 'pixi.js';

export class TestModel {

	public static basicModel: ProjectModel = {
		id: 0,
		board: {
			elements: [
				{
					id: 0,
					typeId: 1,
					inputs: [],
					outputs: [
						1
					],
					pos: new PIXI.Point(17, 1),
					endPos: new PIXI.Point(19, 2)
				},
				{
					id: 1,
					typeId: 0,
					inputs: [
						0
					],
					outputs: [
						3
					],
					pos: new PIXI.Point(10, 10),
					endPos: new PIXI.Point(30, 10)
				},
				{
					id: 3,
					typeId: 0,
					inputs: [
						1
					],
					outputs: [
						2
					],
					pos: new PIXI.Point(20, 5),
					endPos: new PIXI.Point(20, 15)
				},
				{
					id: 2,
					typeId: 2,
					inputs: [
						3
					],
					outputs: [],
					pos: new PIXI.Point(5, 5),
					endPos: new PIXI.Point(7, 7)
				}
			]
		}
	};
}
