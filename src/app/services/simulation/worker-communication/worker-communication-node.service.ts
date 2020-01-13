import {Observable} from 'rxjs';
import {PowerChangesOutWire} from '../../../models/simulation/power-changes';
import {BoardStatus} from '../../../models/simulation/board';
import {Element} from '../../../models/element';
import {WorkerCommunicationServiceModel} from './worker-communication-service';
import {Injectable} from '@angular/core';

@Injectable()
export class WorkerCommunicationNodeService implements WorkerCommunicationServiceModel {

	constructor() { }

	public boardStateWireEnds(projectId: string): Observable<Map<Element, boolean[]>> {
		return undefined;
	}

	boardStateWires(projectId: string): Observable<PowerChangesOutWire> {
		return undefined;
	}

	getWireEndState(identifier: string, data?: Uint8Array): Map<Element, boolean[]> {
		return undefined;
	}

	getWireState(identifier: string, data?: Uint8Array): Map<Element, boolean> {
		return undefined;
	}

	async init(): Promise<void> {
		return undefined;
	}

	get isRunning(): boolean {
		return true;
	}

	pause(): void {
	}

	setFrameTime(frameTime: number): void {
	}

	setTarget(target: number) {
	}

	setUserInput(identifier: string, element: Element, state: boolean[]): void {
	}

	singleStep(): void {
	}

	start(): void {
	}

	startSync(): void {
	}

	startTarget(target?: number): void {
	}

	get status(): BoardStatus {
		return undefined;
	}

	stop(): void {
	}

	subscribe(identifier: string): void {
	}

	unsubscribe(identifier: string): void {
	}
}
