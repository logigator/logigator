import { ContainerChild, Rectangle } from 'pixi.js';

export interface GridElement extends ContainerChild {
	readonly gridBounds: Rectangle;
}
