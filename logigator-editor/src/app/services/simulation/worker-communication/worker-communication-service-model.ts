import {Element} from '../../../models/element';
import {Observable} from 'rxjs';
import {PowerChangesOutWire} from '../../../models/simulation/power-changes';
import {InjectionToken} from '@angular/core';
import {BoardStatus} from '../../../models/simulation/board';

export const WorkerCommunicationService = new InjectionToken<WorkerCommunicationServiceModel>('WorkerCommunication Injection Token');

export abstract class WorkerCommunicationServiceModel {
	public abstract getWireState(identifier: string, data?: Uint8Array | boolean[]): Map<Element, boolean>;

	public abstract getWireEndState(identifier: string, data?: Uint8Array | boolean[]): Map<Element, boolean[]>;

	public abstract init(): Promise<void>;

	public abstract stop(): void;

	public abstract pause(): void;

	public abstract start(threads?: number): void;

	public abstract startTarget(target?: number): void;

	public abstract startSync(): void;

	public abstract setTarget(target: number);

	public abstract singleStep(): void;

	public abstract setFrameTime(frameTime: number): void;

	public abstract setUserInput(identifier: string, element: Element, state: boolean[]): void;

	public abstract boardStateWires(projectId: string): Observable<PowerChangesOutWire>;

	public abstract boardStateWireEnds(projectId: string): Observable<Map<Element, boolean[]>>;

	public abstract onIoCompReset(projectId: string): Observable<void>;

	public abstract get status(): BoardStatus;

	public abstract get isRunning(): boolean;

	public abstract subscribe(identifier: string): void;

	public abstract unsubscribe(identifier: string): void;
}
