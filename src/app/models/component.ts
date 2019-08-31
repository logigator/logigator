export interface Component {
	id: number;
	typeId: number;
	inputs: number[];
	outputs: number[];

	name?: string;
	posX: number;
	posY: number;
	startPosX?: number;
	startPosY?: number;
}
