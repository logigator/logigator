import {Element} from './element';

export interface Chunk {
	elements: Element[];
	connectionPoints: PIXI.Point[];
}
