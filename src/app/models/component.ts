export interface Component {
	id: number;
	type: number;
	inputs: number[];
	outputs: number[];

	name: string;
	posX: number;
	posY: number;
}
