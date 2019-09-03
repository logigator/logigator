export interface Component {
	id: number;
	typeId: number;
	inputs: number[];
	outputs: number[];

	name?: string;
	pos: PIXI.Point;
	startPos?: PIXI.Point;
}
