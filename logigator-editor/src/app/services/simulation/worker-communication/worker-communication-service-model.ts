import { Element } from '../../../models/element';
import { InjectionToken } from '@angular/core';
import { BoardStatus } from '../../../models/simulation/board';

export const WorkerCommunicationService =
	new InjectionToken<WorkerCommunicationServiceModel>(
		'WorkerCommunication Injection Token'
	);

export abstract class WorkerCommunicationServiceModel {

	public abstract init(): Promise<void>;

	public abstract stop(): void;

	public abstract pause(): void;

	public abstract start(threads?: number): void;

	public abstract startTarget(target?: number): void;

	public abstract startSync(): void;

	public abstract setTarget(target: number): void;

	public abstract singleStep(): void;

	public abstract setFrameTime(frameTime: number): void;

	public abstract setUserInput(
		identifier: string,
		element: Element,
		state: boolean[]
	): void;

	public abstract get status(): BoardStatus;

	public abstract get isRunning(): boolean;

}
