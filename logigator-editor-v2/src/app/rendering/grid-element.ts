import { ContainerChild, Point, Rectangle } from 'pixi.js';

export interface GridElement extends ContainerChild {
	readonly gridBounds: Rectangle;
}

export interface Connectable extends GridElement {
	readonly connectionPoints: Point[];
}
