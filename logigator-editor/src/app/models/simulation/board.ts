import { SimulationUnit } from './simulation-unit';

export const enum BoardState {
	Uninitialized,
	Stopped,
	Running,
	Stopping
}

export const enum InputEvent {
	Cont,
	Pulse
}

export interface Board {
	links: number;
	components: ArrayBuffer;
}

export interface BoardStatus {
	tick: number;
	speed: number;
	state: BoardState;
	componentCount: number;
	linkCount: number;
}
