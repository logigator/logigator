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

	public static move(element: Element, dif: PIXI.Point): void {
		element.pos.x += dif.x;
		element.pos.y += dif.y;
		element.endPos.x += dif.x;
		element.endPos.y += dif.y;
	}
}
