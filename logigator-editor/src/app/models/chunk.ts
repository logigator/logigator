import { Element } from './element';

export interface Chunk {
	elements: Set<Element>;
	connectionPoints: PIXI.Point[];
	links: Map<number, { x: number; y: number }>;
}
