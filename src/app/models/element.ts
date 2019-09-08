export interface Element {
	id: number;
	typeId: number;
	inputs: number[];
	outputs: number[];

	pos: PIXI.Point;
	endPos: PIXI.Point;
}
