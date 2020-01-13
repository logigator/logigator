import {Element} from '../../../models/element';
import {Observable} from 'rxjs';
import {PowerChangesOutWire} from '../../../models/simulation/power-changes';
import {Type} from '@angular/core';

export abstract class WorkerCommunicationService {
	public abstract getWireState(identifier: string, data?: Uint8Array): Map<Element, boolean>;

	public abstract getWireEndState(identifier: string, data?: Uint8Array): Map<Element, boolean[]>;

	public abstract async init(): Promise<void>;

	public abstract stop(): void;

	public abstract pause(): void;

	public abstract start(): void;

	public abstract startTarget(target?: number): void;

	public abstract startSync(): void;

	public abstract setTarget(target: number);

	public abstract singleStep(): void;

	public abstract setFrameTime(frameTime: number): void;

	public abstract setUserInput(identifier: string, element: Element, state: boolean[]): void;

	public abstract boardStateWires(projectId: string): Observable<PowerChangesOutWire>;

	public abstract boardStateWireEnds(projectId: string): Observable<Map<Element, boolean[]>>;

	public abstract get status();

	public abstract get isRunning();

	public abstract subscribe(identifier: string): void;

	public abstract unsubscribe(identifier: string): void;
}
