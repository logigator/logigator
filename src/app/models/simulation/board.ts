import {SimulationUnit} from './simulation-unit';

export enum BoardState {
	Uninitialized,
	Stopped,
	Running,
	Stopping
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
