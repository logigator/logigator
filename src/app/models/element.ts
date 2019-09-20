export interface Element {
	id: number;
	typeId: number;
	inputs: number[];
	outputs: number[];

	pos: PIXI.Point;
	endPos: PIXI.Point;
}

export class Elements {

	public static clone(element: Element): Element {
		const out = {...element};
		out.pos = element.pos.clone();
		out.endPos = element.endPos.clone();
		return out;
	}
}
