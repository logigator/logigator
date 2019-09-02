import {ProjectModel} from '../project-model';

export class TestModel {

	public static basicModel: ProjectModel = {
		id: 0,
		board: {
			components: [
				{
					id: 0,
					typeId: 1,
					inputs: [],
					outputs: [
						1
					],
					posX: 17,
					posY: 1
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
					posX: 1,
					posY: 20
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
					posX: 40,
					posY: 40
				},
				{
					id: 2,
					typeId: 2,
					inputs: [
						3
					],
					outputs: [],
					posX: 5,
					posY: 5
				}
			]
		}
	};
}
